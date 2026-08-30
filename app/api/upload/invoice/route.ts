import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"

import { NextResponse } from "next/server"
import { Prisma } from "@/generated/client"

import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/db"

const ALLOWED = new Map([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/webp", ".webp"],
])

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return bad("Sign in to upload documents", 401)
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return bad("Invalid form data")
  }

  const file = form.get("file")
  const vendor = String(form.get("vendor") || "").trim()
  const amount = Number(form.get("amount"))
  const issueDate = String(form.get("issueDate") || "")
  const dueDate = String(form.get("dueDate") || "")
  const rawNumber = String(form.get("invoiceNumber") || "").trim()
  const poIdRaw = String(form.get("poId") || "").trim()

  if (!(file instanceof File) || file.size === 0) return bad("Invoice image is required")
  if (!vendor) return bad("Vendor is required")
  if (vendor.length > 200) return bad("Vendor name too long")
  if (!Number.isFinite(amount) || amount <= 0) return bad("Amount must be a positive number")
  if (amount > 1_000_000_000) return bad("Amount is unrealistically large")
  const issue = new Date(issueDate)
  const due = new Date(dueDate)
  if (Number.isNaN(issue.getTime())) return bad("Valid issue date is required")
  if (Number.isNaN(due.getTime())) return bad("Valid due date is required")
  if (due < issue) return bad("Due date cannot be before the issue date")

  let poId: string | null = null
  if (poIdRaw) {
    const po = await prisma.policyDocument.findUnique({ where: { id: poIdRaw }, select: { id: true } })
    if (!po) return bad("Linked PO not found", 404)
    poId = po.id
  }

  const ext = ALLOWED.get(file.type)
  if (!ext) return bad("Only PNG, JPG or WebP invoice images are supported")

  const count = await prisma.invoice.count()
  const number =
    rawNumber || `INV-2026-${String(count + 1).padStart(4, "0")}`
  const existing = await prisma.invoice.findUnique({ where: { number } })
  if (existing) return bad(`Invoice number ${number} already exists`, 409)

  const uploadsDir = path.join(process.cwd(), "public", "uploads")
  await mkdir(uploadsDir, { recursive: true })
  const fileName = `${randomUUID()}${ext}`
  await writeFile(path.join(uploadsDir, fileName), Buffer.from(await file.arrayBuffer()))

  let invoice
  try {
    invoice = await prisma.invoice.create({
      data: {
        number,
        vendor,
        vendorClean: vendor
          .toLowerCase()
          .replace(/\bm\/s\b|\bltd\.?|\blimited|\(bd\)|[.&]/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
        amount,
        issueDate: issue,
        dueDate: due,
        isScanned: true,
        imagePath: `/uploads/${fileName}`,
        expectedMatch: "",
        poId,
      },
    })
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return bad(`Invoice number ${number} already exists`, 409)
    }
    throw e
  }

  return NextResponse.json({ ok: true, invoice: { id: invoice.id, number: invoice.number } })
}
