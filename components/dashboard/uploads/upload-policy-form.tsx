"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  FileWarningIcon,
  ScanLineIcon,
  UploadIcon,
  XCircleIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Stepper } from "@/components/dashboard/uploads/stepper"

const STEPS = ["Document", "Details", "Confirm"]

async function extractPdfText(file: File): Promise<string> {
  const { pdfjs } = await import("react-pdf")
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
  const data = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data }).promise
  let text = ""
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    text += content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
    text += "\n\n"
  }
  return text
}

async function ocrScannedPdf(
  file: File,
  onProgress?: (page: number, total: number) => void,
): Promise<string> {
  const { pdfjs } = await import("react-pdf")
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
  const data = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data }).promise
  const pages = Math.min(doc.numPages, 3)
  let text = ""
  for (let i = 1; i <= pages; i++) {
    onProgress?.(i, pages)
    const page = await doc.getPage(i)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement("canvas")
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext("2d")
    if (!ctx) continue
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    )
    if (!blob) continue
    const fd = new FormData()
    fd.set("file", new File([blob], `page-${i}.png`, { type: "image/png" }))
    fd.set("mode", "text")
    try {
      const res = await fetch("/api/ocr/preview", { method: "POST", body: fd })
      const body = (await res.json()) as { ok: boolean; text?: string }
      if (body.ok && body.text) {
        text += body.text + "\n\n"
      }
    } catch {
      continue
    }
  }
  return text
}

export function UploadPolicyForm() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [reading, setReading] = useState(false)
  const [extractLabel, setExtractLabel] = useState("Extracting text…")
  const [text, setText] = useState("")
  const [scannedOcr, setScannedOcr] = useState(false)
  const [vendor, setVendor] = useState("")
  const [title, setTitle] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [noText, setNoText] = useState(false)

  function reset() {
    setStep(0)
    setFile(null)
    setText("")
    setScannedOcr(false)
    setVendor("")
    setTitle("")
    setError(null)
    setDone(null)
    setNoText(false)
    if (fileRef.current) fileRef.current.value = ""
  }

  async function processFile() {
    const selected = fileRef.current?.files?.[0]
    if (!selected) return
    setFile(selected)
    setText("")
    setScannedOcr(false)
    setError(null)
    setDone(null)
    setReading(true)
    try {
      let extracted = ""
      try {
        extracted = await extractPdfText(selected)
      } catch {
        extracted = ""
      }
      if (extracted.trim().length < 40) {
        try {
          const ocrText = await ocrScannedPdf(selected, (page, total) => {
            setExtractLabel(`Reading scanned page ${page}/${total} with OCR…`)
          })
          if (ocrText.trim().length > 0) {
            extracted = ocrText
            setScannedOcr(true)
          }
        } catch {
          // keep whatever text we have
        }
      }
      setText(extracted)
    } finally {
      setReading(false)
    }
  }

  function canLeaveStep0() {
    return Boolean(file) && !reading
  }

  function step1Valid() {
    return vendor.trim().length > 0
  }

  async function submit() {
    if (!file) return
    setPending(true)
    setError(null)
    try {
      const form = new FormData()
      form.set("file", file)
      form.set("vendor", vendor)
      if (title.trim()) form.set("title", title)
      form.set("text", text)

      const res = await fetch("/api/upload/policy", { method: "POST", body: form })
      const body = (await res.json()) as {
        ok: boolean
        error?: string
        document?: { title: string }
        textExtracted?: boolean
      }
      if (!body.ok) {
        setError(body.error || "Upload failed.")
        return
      }
      if (!body.textExtracted) {
        setNoText(true)
        setDone(
          `${body.document?.title} uploaded — but no readable text was found. The compliance agent needs text to review.`,
        )
      } else if (scannedOcr) {
        setDone(`${body.document?.title} uploaded — text recovered from the scan via OCR.`)
      } else {
        setDone(`${body.document?.title} uploaded.`)
      }
      router.refresh()
    } catch {
      setError("Upload failed — is the server running?")
    } finally {
      setPending(false)
    }
  }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0

  return (
    <div className="flex flex-col gap-5">
      <Stepper steps={STEPS} current={step} />

      {done ? (
        <div className="flex flex-col items-start gap-3 border border-l-4 border-l-primary bg-muted/40 p-4">
          <p
            className={`flex items-start gap-2 text-sm font-medium ${noText ? "text-foreground" : "text-primary"}`}
          >
            {noText ? (
              <FileWarningIcon className="mt-0.5 size-4 shrink-0" />
            ) : (
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
            )}
            {done}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button size="sm" render={<Link href="/dashboard/compliance" />}>
              Check against rulebook
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
            <Button variant="outline" size="sm" onClick={reset}>
              Upload another
            </Button>
          </div>
        </div>
      ) : (
        <>
          {step === 0 ? (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="po-file">PO / contract PDF</FieldLabel>
                <Input
                  id="po-file"
                  name="file"
                  type="file"
                  accept="application/pdf"
                  className="py-1.5 text-xs"
                  ref={fileRef}
                  onChange={processFile}
                  disabled={reading}
                />
                <FieldDescription className="flex items-center gap-1.5">
                  {reading ? (
                    <>
                      <Spinner className="size-3" />
                      {extractLabel}
                    </>
                  ) : (
                    <>
                      <ScanLineIcon className="size-3.5" />
                      Digital or scanned — text is extracted in your browser.
                    </>
                  )}
                </FieldDescription>
              </Field>
              {file && !reading ? (
                <p className="border-l-2 border-l-primary pl-3 text-xs text-muted-foreground">
                  {scannedOcr
                    ? "Digital text was unreadable — recovered via OCR."
                    : words > 0
                      ? `Extracted ${words} words of contract text.`
                      : "No text found yet — continue to review."}
                </p>
              ) : null}
            </FieldGroup>
          ) : null}

          {step === 1 ? (
            <FieldGroup>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="po-vendor">Vendor</FieldLabel>
                  <Input
                    id="po-vendor"
                    placeholder="Chittagong Steel House"
                    required
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="po-title">Title (optional)</FieldLabel>
                  <Input
                    id="po-title"
                    placeholder="auto"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel>Extracted text preview</FieldLabel>
                <div className="max-h-32 overflow-auto border bg-muted/40 p-3 text-xs text-muted-foreground">
                  {text.trim().length > 0 ? (
                    <p className="line-clamp-6">{text.trim().slice(0, 600)}…</p>
                  ) : (
                    <p>
                      No text extracted — likely an unreadable scan. You can
                      still upload, but the compliance agent will have nothing
                      to review.
                    </p>
                  )}
                </div>
              </Field>
            </FieldGroup>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-2 border bg-muted/40 p-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-muted-foreground">File</span>
                <span className="truncate font-medium">{file?.name}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-muted-foreground">Vendor</span>
                <span className="truncate">{vendor}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-muted-foreground">Title</span>
                <span className="truncate">{title || "auto"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-muted-foreground">Text</span>
                <span>
                  {words > 0 ? `${words} words${scannedOcr ? " (via OCR)" : ""}` : "none"}
                </span>
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <XCircleIcon className="size-4" />
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || pending}
            >
              <ArrowLeftIcon data-icon="inline-start" />
              Back
            </Button>
            {step < 2 ? (
              <Button
                size="sm"
                disabled={(step === 0 && !canLeaveStep0()) || (step === 1 && !step1Valid())}
                onClick={() => {
                  setError(null)
                  setStep((s) => Math.min(2, s + 1))
                }}
              >
                Next
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            ) : (
              <Button size="sm" onClick={submit} disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" /> : <UploadIcon data-icon="inline-start" />}
                Upload PO
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
