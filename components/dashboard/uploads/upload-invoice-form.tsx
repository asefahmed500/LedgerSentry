"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  FileTextIcon,
  Link2Icon,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Stepper } from "@/components/dashboard/uploads/stepper"

const STEPS = ["Scan", "Review & link", "Confirm"]

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export interface PoOption {
  id: string
  title: string
  vendor: string
}

export function UploadInvoiceForm({ poOptions }: { poOptions: PoOption[] }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [reading, setReading] = useState(false)
  const [ocrNote, setOcrNote] = useState<string | null>(null)
  const [vendor, setVendor] = useState("")
  const [amount, setAmount] = useState("")
  const [issueDate, setIssueDate] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [poId, setPoId] = useState<string>("none")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  function reset() {
    setStep(0)
    setFile(null)
    setOcrNote(null)
    setVendor("")
    setAmount("")
    setIssueDate("")
    setDueDate("")
    setInvoiceNumber("")
    setPoId("none")
    setError(null)
    setDone(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  async function onFileSelected() {
    const selected = fileRef.current?.files?.[0]
    if (!selected) return
    setFile(selected)
    setOcrNote(null)
    setError(null)
    setReading(true)
    try {
      const fd = new FormData()
      fd.set("file", selected)
      const res = await fetch("/api/ocr/preview", { method: "POST", body: fd })
      const body = (await res.json()) as {
        ok: boolean
        fields?: {
          vendor: string
          invoiceNumber: string
          amount: number
          issueDate: string
          dueDate: string
          source: string
          confidence: number
        }
      }
      if (body.ok && body.fields) {
        const f = body.fields
        if (f.vendor) setVendor(f.vendor)
        if (f.amount) setAmount(String(f.amount))
        if (/^\d{4}-\d{2}-\d{2}$/.test(f.issueDate)) setIssueDate(f.issueDate)
        if (/^\d{4}-\d{2}-\d{2}$/.test(f.dueDate)) setDueDate(f.dueDate)
        if (f.invoiceNumber) setInvoiceNumber(f.invoiceNumber)
        setOcrNote(`Auto-read with ${f.source} (confidence ${f.confidence}%) — verify on the next step.`)
      } else {
        setOcrNote("Could not auto-read this scan — fill the fields on the next step.")
      }
    } catch {
      setOcrNote("Auto-read failed — fill the fields on the next step.")
    } finally {
      setReading(false)
    }
  }

  function canLeaveStep0() {
    return Boolean(file) && !reading
  }

  function normalizedAmount() {
    return Number(String(amount).replace(/,/g, ""))
  }

  function step1Error() {
    if (!vendor.trim()) return "Vendor is required."
    if (!(normalizedAmount() > 0)) return "Amount must be a positive number."
    if (!issueDate || !dueDate) return "Both dates are required."
    if (new Date(dueDate) < new Date(issueDate))
      return "Due date cannot be before the issue date."
    return null
  }

  async function submit() {
    if (!file) return
    setPending(true)
    setError(null)
    try {
      const form = new FormData()
      form.set("file", file)
      form.set("vendor", vendor)
      form.set("amount", String(normalizedAmount()))
      form.set("issueDate", issueDate)
      form.set("dueDate", dueDate)
      if (invoiceNumber.trim()) form.set("invoiceNumber", invoiceNumber)
      if (poId !== "none") form.set("poId", poId)

      const res = await fetch("/api/upload/invoice", { method: "POST", body: form })
      const body = (await res.json()) as {
        ok: boolean
        error?: string
        invoice?: { number: string }
      }
      if (!body.ok) {
        setError(body.error || "Upload failed.")
        return
      }
      setDone(`${body.invoice?.number} is in the ledger.`)
      router.refresh()
    } catch {
      setError("Upload failed — is the server running?")
    } finally {
      setPending(false)
    }
  }

  const today = new Date()
  const in30 = new Date(today.getTime() + 30 * 86400000)
  const linkedPo = poOptions.find((p) => p.id === poId)

  return (
    <div className="flex flex-col gap-5">
      <Stepper steps={STEPS} current={step} />

      {done ? (
        <div className="flex flex-col items-start gap-3 border border-l-4 border-l-primary bg-muted/40 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            <CheckCircle2Icon className="size-4" />
            {done}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button size="sm" render={<Link href="/dashboard/reconciliation" />}>
              Run the agent
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
                <FieldLabel htmlFor="inv-file">Scanned invoice image</FieldLabel>
                <Input
                  id="inv-file"
                  name="file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="py-1.5 text-xs"
                  ref={fileRef}
                  onChange={onFileSelected}
                  disabled={reading}
                />
                <FieldDescription className="flex items-center gap-1.5">
                  {reading ? (
                    <>
                      <Spinner className="size-3" />
                      Reading the scan with OCR…
                    </>
                  ) : (
                    <>
                      <ScanLineIcon className="size-3.5" />
                      PNG, JPG or WebP — fields auto-fill from the scan.
                    </>
                  )}
                </FieldDescription>
              </Field>
              {ocrNote ? (
                <p className="border-l-2 border-l-primary pl-3 text-xs text-muted-foreground">
                  {ocrNote}
                </p>
              ) : null}
            </FieldGroup>
          ) : null}

          {step === 1 ? (
            <FieldGroup>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="inv-vendor">Vendor</FieldLabel>
                  <Input
                    id="inv-vendor"
                    placeholder="Rahman & Sons"
                    required
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="inv-amount">Amount (BDT)</FieldLabel>
                  <Input
                    id="inv-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="482500.00"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="inv-issue">Issue date</FieldLabel>
                  <Input
                    id="inv-issue"
                    type="date"
                    required
                    value={issueDate || toISODate(today)}
                    onChange={(e) =>
                      setIssueDate(e.target.value || toISODate(today))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="inv-due">Due date</FieldLabel>
                  <Input
                    id="inv-due"
                    type="date"
                    required
                    value={dueDate || toISODate(in30)}
                    onChange={(e) =>
                      setDueDate(e.target.value || toISODate(in30))
                    }
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="inv-number">Invoice number (optional)</FieldLabel>
                  <Input
                    id="inv-number"
                    placeholder="auto"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="inv-po">
                    <span className="inline-flex items-center gap-1.5">
                      <Link2Icon className="size-3.5" />
                      Linked PO (optional)
                    </span>
                  </FieldLabel>
                  <Select
                    items={[
                      { value: "none", label: "No PO — not linked" },
                      ...poOptions.map((p) => ({
                        value: p.id,
                        label: `${p.title} · ${p.vendor}`,
                      })),
                    ]}
                    value={poId}
                    onValueChange={(v) => setPoId(v ?? "none")}
                  >
                    <SelectTrigger id="inv-po" className="w-full">
                      <SelectValue placeholder="No PO" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No PO — not linked</SelectItem>
                      {poOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title} · {p.vendor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Attach the contract this invoice bills against — its
                    compliance status shows on the invoice.
                  </FieldDescription>
                </Field>
              </div>
            </FieldGroup>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-3 border bg-muted/40 p-4 text-sm">
              <div className="flex items-center gap-2">
                <FileTextIcon className="size-4 text-muted-foreground" />
                <p className="truncate font-medium">{file?.name}</p>
              </div>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                <div className="flex justify-between gap-4 sm:block">
                  <dt className="text-xs text-muted-foreground">Vendor</dt>
                  <dd className="truncate">{vendor}</dd>
                </div>
                <div className="flex justify-between gap-4 sm:block">
                  <dt className="text-xs text-muted-foreground">Amount</dt>
                  <dd className="font-mono">{amount} BDT</dd>
                </div>
                <div className="flex justify-between gap-4 sm:block">
                  <dt className="text-xs text-muted-foreground">Dates</dt>
                  <dd>
                    {issueDate} → {dueDate}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 sm:block">
                  <dt className="text-xs text-muted-foreground">Invoice #</dt>
                  <dd>{invoiceNumber || "auto"}</dd>
                </div>
                <div className="flex justify-between gap-4 sm:col-span-2 sm:block">
                  <dt className="text-xs text-muted-foreground">Linked PO</dt>
                  <dd>
                    {linkedPo ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Link2Icon className="size-3.5 text-primary" />
                        {linkedPo.title} · {linkedPo.vendor}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">not linked</span>
                    )}
                  </dd>
                </div>
              </dl>
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
                disabled={step === 0 && !canLeaveStep0()}
                onClick={() => {
                  if (step === 1) {
                    const problem = step1Error()
                    if (problem) {
                      setError(problem)
                      return
                    }
                  }
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
                Upload invoice
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
