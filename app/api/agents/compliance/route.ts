import { NextResponse } from "next/server"

export const maxDuration = 300

import { runComplianceAgent } from "@/lib/agent/compliance"

export async function POST(request: Request) {
  let body: { documentId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.documentId) {
    return NextResponse.json({ ok: false, error: "documentId is required" }, { status: 400 })
  }

  try {
    const output = await runComplianceAgent(body.documentId)
    return NextResponse.json({ ok: true, output })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const missingKey = !process.env.ZHIPU_API_KEY
    return NextResponse.json(
      {
        ok: false,
        error: missingKey
          ? "ZHIPU_API_KEY is not set — add it to .env and restart the dev server."
          : message,
      },
      { status: missingKey ? 503 : 500 },
    )
  }
}
