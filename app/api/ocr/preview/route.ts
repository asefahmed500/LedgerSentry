import { NextResponse } from "next/server"

import { extractFromBuffer, extractRawTextFromBuffer } from "@/lib/agent/ocr"

export const maxDuration = 120

const MAX_BYTES = 8 * 1024 * 1024

export async function POST(request: Request) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid form data" }, { status: 400 })
  }

  const file = form.get("file")
  const mode = String(form.get("mode") || "fields")
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "File is required" }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "File too large (max 8MB)" }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    if (mode === "text") {
      const { text, source } = await extractRawTextFromBuffer(buffer)
      return NextResponse.json({ ok: true, text, source })
    }
    const fallback = {
      vendor: "",
      invoiceNumber: "",
      amount: 0,
      issueDate: "",
      dueDate: "",
      confidence: 0,
    }
    const fields = await extractFromBuffer(buffer, fallback)
    return NextResponse.json({ ok: true, fields })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
