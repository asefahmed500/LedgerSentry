import "dotenv/config"

import { writeFile, mkdir } from "node:fs/promises"
import path from "node:path"

import { prisma } from "../lib/db"

async function exportRun(name: string, runId: string) {
  const run = await prisma.agentRun.findUnique({
    where: { id: runId },
    include: { steps: { orderBy: { index: "asc" } } },
  })
  if (!run) {
    console.log(`skip ${name}: run not found`)
    return
  }
  const out = {
    description: name,
    agent: run.kind,
    model: run.model,
    status: run.status,
    inputRef: run.inputRef,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    finalOutput: run.output,
    steps: run.steps.map((s) => ({
      step: s.index,
      type: s.type,
      tool: s.toolName,
      input: s.input,
      output: s.output,
      reasoning: s.reasoning,
    })),
  }
  const file = path.join(process.cwd(), "trajectories", `${name}.json`)
  await writeFile(file, JSON.stringify(out, null, 2))
  console.log(`exported ${file}`)
}

async function findReconRun(filter: {
  status?: string
  matchType?: string
  explanationContains?: string
}): Promise<string | null> {
  const results = await prisma.matchResult.findMany({
    where: {
      engine: "agent",
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.matchType ? { matchType: filter.matchType } : {}),
      ...(filter.explanationContains
        ? { explanation: { contains: filter.explanationContains, mode: "insensitive" as const } }
        : {}),
      runId: { not: null },
    },
    orderBy: { confidence: "desc" },
    take: 1,
  })
  return results[0]?.runId ?? null
}

async function main() {
  await mkdir(path.join(process.cwd(), "trajectories"), { recursive: true })

  const cleanRun = await findReconRun({ status: "matched", matchType: "exact" })
  if (cleanRun) await exportRun("01-clean-exact-match", cleanRun)

  const fuzzyRun = await findReconRun({ status: "matched", matchType: "fuzzy" })
  if (fuzzyRun) {
    await exportRun("02-fuzzy-vendor-name", fuzzyRun)
  } else {
    const typoVendors = [
      "ABC Traders Ltd",
      "Rahman & Sons",
      "Dhaka Textiles Mills",
      "Sylhet Tea Estates",
      "Jamuna Hardware",
    ]
    const result = await prisma.matchResult.findFirst({
      where: {
        engine: "agent",
        status: "matched",
        runId: { not: null },
        invoice: { vendor: { in: typoVendors } },
      },
      orderBy: { confidence: "desc" },
    })
    if (result?.runId) await exportRun("02-fuzzy-vendor-name", result.runId)
  }

  const partialRun = await findReconRun({ status: "partial" })
  if (partialRun) await exportRun("03-partial-payment", partialRun)

  const violation = await prisma.complianceResult.findFirst({
    where: { engine: "agent", status: "violation", runId: { not: null } },
    orderBy: { confidence: "desc" },
  })
  if (violation?.runId) await exportRun("04-compliance-violation-cited", violation.runId)

  const ambiguousDoc = await prisma.reviewItem.findFirst({
    where: { kind: "compliance" },
    orderBy: { createdAt: "desc" },
  })
  if (ambiguousDoc) {
    const byTitle = await prisma.policyDocument.findUnique({
      where: { id: ambiguousDoc.refId },
    })
    if (byTitle) {
      const run = await prisma.agentRun.findFirst({
        where: { kind: "compliance", inputRef: byTitle.id, status: "complete" },
        orderBy: { startedAt: "desc" },
        select: { id: true },
      })
      if (run) await exportRun("05-compliance-ambiguous-human-review", run.id)
    }
  }

  await prisma.$disconnect()
  process.exit(0)
}

main()
