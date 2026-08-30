import { readFile } from "node:fs/promises"
import path from "node:path"

import { generateText } from "ai"

import { prisma } from "@/lib/db"
import type { ExtractedInvoiceFields } from "@/lib/types"
import { visionModel } from "@/lib/agent/zhipu"
import { jaroWinkler, normalizeEntityName } from "@/lib/fuzzy"

const EXTRACT_PROMPT = `You are an invoice data extraction engine. Read the invoice image and extract the following fields as strict JSON, no markdown fences, no commentary:
{
  "vendor": "vendor/company name billed from",
  "invoiceNumber": "invoice number",
  "amount": number (total due, numeric only),
  "issueDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "confidence": number 0-100 (your confidence in the extraction)
}
If a field is unreadable, use your best guess and lower the confidence.`

const memoryCache = new Map<string, ExtractedInvoiceFields>()

let visionSupported: boolean | null = null

function publicPath(relPath: string) {
  return path.join(process.cwd(), "public", relPath.replace(/^\//, ""))
}

function isVisionUnsupportedError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /content\.type|image|unsupported|invalid.*content|not support/i.test(message)
}

async function visionFromBuffer(buffer: Buffer): Promise<ExtractedInvoiceFields> {
  const { text } = await generateText({
    model: visionModel(),
    maxRetries: 5,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: EXTRACT_PROMPT },
          { type: "image", image: `data:image/png;base64,${buffer.toString("base64")}` },
        ],
      },
    ],
  })
  const cleaned = text.replace(/```json|```/g, "").trim()
  const parsed = JSON.parse(cleaned) as Omit<ExtractedInvoiceFields, "source">
  return { ...parsed, amount: Number(parsed.amount), source: "vision" }
}

let tessWorker: Awaited<ReturnType<typeof createTessWorker>> | null = null

async function createTessWorker() {
  const { createWorker } = await import("tesseract.js")
  return createWorker("eng", 1, { cachePath: "./.tesseract" })
}

async function getTessWorker() {
  if (!tessWorker) tessWorker = await createTessWorker()
  return tessWorker
}

async function tesseractFromBuffer(
  buffer: Buffer,
  fallback: Omit<ExtractedInvoiceFields, "source">,
): Promise<ExtractedInvoiceFields> {
  const worker = await getTessWorker()
  const { data } = await worker.recognize(buffer)
  return parseOcrText(data.text ?? "", fallback)
}

export function parseOcrText(
  text: string,
  fallback: Omit<ExtractedInvoiceFields, "source">,
): ExtractedInvoiceFields {
  const totalMatch = text.match(/total[^0-9\n]{0,60}([0-9][0-9,]*(?:\.[0-9]{2})?)/i)
  const amountMatch =
    totalMatch?.[1] ??
    text.match(/(?:due|amount|bdt)[^0-9\n]{0,40}([0-9][0-9,]*(?:\.[0-9]{2})?)/i)?.[1]
  const numberMatch = text.match(/INV[-\s]?\d{4}[-\s]?\d{3,4}/i)
  const dates = text.match(/\d{4}-\d{2}-\d{2}/g) || []
  const vendorMatch = text.match(/billed by[:\s]+([^\n]+)/i)

  const ocrNumber = numberMatch ? numberMatch[0].replace(/\s/g, "") : ""
  const ocrAmount = amountMatch ? Number(amountMatch.replace(/,/g, "")) : 0
  const ocrVendor = vendorMatch ? vendorMatch[1].trim() : ""

  // Confidence reflects how well the OCR agrees with the human-verified
  // ledger record (the fallback), not a fixed guess.
  let confidence = 25
  if (ocrNumber && ocrNumber === fallback.invoiceNumber) confidence += 25
  else if (ocrNumber) confidence += 8
  const amountDelta =
    ocrAmount > 0 && fallback.amount > 0
      ? Math.abs(ocrAmount - fallback.amount) / fallback.amount
      : 1
  if (amountDelta <= 0.02) confidence += 30
  else if (amountDelta <= 0.1) confidence += 12
  if (ocrVendor) {
    const vendorScore = jaroWinkler(
      normalizeEntityName(ocrVendor),
      normalizeEntityName(fallback.vendor || ""),
    )
    if (vendorScore >= 0.85) confidence += 20
    else if (vendorScore >= 0.7) confidence += 10
  }

  return {
    vendor: ocrVendor || fallback.vendor,
    invoiceNumber: ocrNumber || fallback.invoiceNumber,
    amount: ocrAmount || fallback.amount,
    issueDate: dates[0] || fallback.issueDate,
    dueDate: dates[1] || dates[0] || fallback.dueDate,
    source: "tesseract",
    confidence: Math.min(confidence, 90),
  }
}

export async function extractFromBuffer(
  buffer: Buffer,
  fallback: Omit<ExtractedInvoiceFields, "source">,
): Promise<ExtractedInvoiceFields> {
  if (visionSupported !== false) {
    try {
      const result = await visionFromBuffer(buffer)
      visionSupported = true
      return result
    } catch (error) {
      if (visionSupported === null && isVisionUnsupportedError(error)) {
        visionSupported = false
      }
    }
  }
  return tesseractFromBuffer(buffer, fallback)
}

const TRANSCRIBE_PROMPT =
  "Transcribe ALL visible text in this document image verbatim, preserving reading order. Output text only, no commentary."

export async function extractRawTextFromBuffer(buffer: Buffer): Promise<{
  text: string
  source: "vision" | "tesseract"
}> {
  if (visionSupported !== false) {
    try {
      const { text } = await generateText({
        model: visionModel(),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: TRANSCRIBE_PROMPT },
              { type: "image", image: `data:image/png;base64,${buffer.toString("base64")}` },
            ],
          },
        ],
      })
      visionSupported = true
      return { text: text.trim(), source: "vision" }
    } catch (error) {
      if (visionSupported === null && isVisionUnsupportedError(error)) {
        visionSupported = false
      }
    }
  }
  const worker = await getTessWorker()
  const { data } = await worker.recognize(buffer)
  return { text: (data.text ?? "").trim(), source: "tesseract" }
}

export async function extractDocumentFields(
  invoiceId: string,
  provider: "vision" | "tesseract" = "vision",
): Promise<ExtractedInvoiceFields> {
  const cacheKey = `${invoiceId}:${provider}`
  const cached = memoryCache.get(cacheKey)
  if (cached) return cached

  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })
  const fallback = {
    vendor: invoice.vendor,
    invoiceNumber: invoice.number,
    amount: Number(invoice.amount),
    issueDate: invoice.issueDate.toISOString().slice(0, 10),
    dueDate: invoice.dueDate.toISOString().slice(0, 10),
    confidence: 99,
  }

  let result: ExtractedInvoiceFields
  if (!invoice.isScanned || !invoice.imagePath) {
    result = { ...fallback, source: "database" }
  } else {
    const buffer = await readFile(publicPath(invoice.imagePath))
    if (provider === "vision" && visionSupported !== false) {
      try {
        result = await visionFromBuffer(buffer)
        visionSupported = true
      } catch (error) {
        if (visionSupported === null && isVisionUnsupportedError(error)) {
          visionSupported = false
        }
        result = await tesseractFromBuffer(buffer, fallback)
      }
    } else {
      result = await tesseractFromBuffer(buffer, fallback)
    }
  }

  if (!invoice.ocrText && invoice.isScanned) {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { ocrText: JSON.stringify(result) },
    })
  }
  memoryCache.set(cacheKey, result)
  return result
}
