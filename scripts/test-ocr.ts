import "dotenv/config"

import { readFile } from "node:fs/promises"
import path from "node:path"

import { extractRawTextFromBuffer } from "../lib/agent/ocr"

const SAMPLES = [
  {
    name: "clean seeded scan (agrees with ledger)",
    file: "public/scans/inv-2026-0031.png",
    ledger: { vendor: "Green Delta Stationers", invoiceNumber: "INV-2026-0031", amount: 529290.37 },
  },
]

const tesseract = await import("tesseract.js")
const worker = await tesseract.createWorker("eng", 1, { cachePath: "./.tesseract" })

for (const s of SAMPLES) {
  const buffer = await readFile(path.join(process.cwd(), s.file))
  const { data } = await worker.recognize(buffer)
  const text = data.text ?? ""
  console.log(`\n=== ${s.name} ===`)
  console.log("raw OCR (first 300):", JSON.stringify(text.slice(0, 300)))
  // replicate parseOcrText extraction
  const totalMatch = text.match(/total[^0-9\n]{0,60}([0-9][0-9,]*(?:\.[0-9]{2})?)/i)
  const numberMatch = text.match(/INV[-\s]?\d{4}[-\s]?\d{3,4}/i)
  const vendorMatch = text.match(/billed by[:\s]+([^\n]+)/i)
  console.log("extracted:", {
    vendor: vendorMatch?.[1]?.trim(),
    invoiceNumber: numberMatch?.[0]?.replace(/\s/g, ""),
    amount: totalMatch?.[1],
    ledger: s.ledger,
  })
}

// garbled / wrong-value cases against parseOcrText's confidence logic
const { parseOcrText } = await import("../lib/agent/ocr")
const fb = { vendor: "Green Delta Stationers", invoiceNumber: "INV-2026-0031", amount: 529290.37, issueDate: "2026-06-21", dueDate: "2026-07-18", confidence: 0 }
const cases = [
  { name: "garbled vendor, correct number+amount", text: "INVOlCE\nInvoice No: INV-2026-0031\nbilled by: Green Delta Stahaners\nTotal Due: BDT 529,290.37" },
  { name: "wrong amount (OCR misread), rest correct", text: "INVOICE\nInvoice No: INV-2026-0031\nbilled by: Green Delta Stationers\nTotal Due: BDT 529,290.97" },
  { name: "total garbage", text: "s9d8f7sdf sdf9su sf9u sfsdf" },
  { name: "perfect", text: "INVOICE\nInvoice No: INV-2026-0031\nbilled by: Green Delta Stationers\nTotal Due: BDT 529,290.37\n2026-06-21\n2026-07-18" },
]
console.log("\n=== confidence heuristic ===")
for (const c of cases) {
  const r = parseOcrText(c.text, fb)
  console.log(`${c.name}: confidence=${r.confidence} amount=${r.amount} number=${r.invoiceNumber}`)
}

await worker.terminate()
process.exit(0)
