import { NextResponse } from "next/server"

import { runBaselineComplianceAll } from "@/lib/baseline/compliance"

export async function POST() {
  try {
    const count = await runBaselineComplianceAll()
    return NextResponse.json({ ok: true, count })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
