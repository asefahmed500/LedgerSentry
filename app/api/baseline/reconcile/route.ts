import { NextResponse } from "next/server"

import { runBaselineReconciliationAll } from "@/lib/baseline/reconciler"

export async function POST() {
  try {
    const count = await runBaselineReconciliationAll()
    return NextResponse.json({ ok: true, count })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
