import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"

import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/db"

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
  const rawTitle = String(form.get("title") || "").trim()
  const text = String(form.get("text") || "")

  if (!(file instanceof File) || file.size === 0) return bad("PO PDF is required")
  if (file.size > 20 * 1024 * 1024) return bad("File too large (max 20MB)")
  if (!vendor) return bad("Vendor is required")
  if (vendor.length > 200) return bad("Vendor name too long")
  if (file.type && file.type !== "application/pdf") return bad("Only PDF files are supported")
  if (rawTitle.length > 120) return bad("Title too long")

  const count = await prisma.policyDocument.count()
  const title = rawTitle || `PO-UPLOAD-${String(count + 1).padStart(3, "0")}`
  const existing = await prisma.policyDocument.findFirst({ where: { title } })
  if (existing) return bad(`A document titled ${title} already exists`, 409)

  const uploadsDir = path.join(process.cwd(), "public", "uploads")
  await mkdir(uploadsDir, { recursive: true })
  const fileName = `${randomUUID()}.pdf`
  await writeFile(path.join(uploadsDir, fileName), Buffer.from(await file.arrayBuffer()))

  const doc = await prisma.policyDocument.create({
    data: {
      title,
      vendor,
      text,
      pdfPath: `/uploads/${fileName}`,
      expectedViolations: [],
    },
  })

  return NextResponse.json({
    ok: true,
    document: { id: doc.id, title: doc.title },
    textExtracted: text.trim().length > 0,
  })
}
