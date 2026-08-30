import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const run = await prisma.agentRun.findUnique({
    where: { id },
    include: { steps: { orderBy: { index: "asc" } } },
  })
  if (!run) {
    return NextResponse.json({ ok: false, error: "Run not found" }, { status: 404 })
  }
  return new NextResponse(JSON.stringify(run, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="trajectory-${run.kind}-${run.id}.json"`,
    },
  })
}
