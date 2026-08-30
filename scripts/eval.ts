import "dotenv/config"

import type { Prisma } from "../generated/client" 
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/client"

import { runBaselineReconciliationAll } from "../lib/baseline/reconciler"
import { runBaselineComplianceAll } from "../lib/baseline/compliance"
import { runReconciliationAgent } from "../lib/agent/reconciliation"
import { runComplianceAgent } from "../lib/agent/compliance"
import { agentModelId } from "../lib/agent/zhipu"
import type { EvalMetrics } from "../lib/types"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

const WITH_AGENT =
  process.argv.includes("--with-agent") || process.env.RUN_AGENT_EVAL === "1"
const FORCE = process.argv.includes("--force")
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY || 1)
const sampleArg = process.argv.find((a) => a.startsWith("--sample="))
const SAMPLE = sampleArg ? Number(sampleArg.split("=")[1]) : Number(process.env.EVAL_SAMPLE || 0)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function isRateLimit(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /rate limit|429|too many|overloaded|503|temporarily/i.test(message)
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 4,
  baseDelayMs = 30000,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (!isRateLimit(error) || attempt === attempts) throw error
      const delay = baseDelayMs * attempt
      console.warn(`  throttled — retry ${attempt}/${attempts - 1} in ${delay / 1000}s`)
      await sleep(delay)
    }
  }
  throw lastError
}

function evenlySpaced<T>(items: T[], count: number): T[] {
  if (count <= 0 || items.length <= count) return items
  const step = items.length / count
  return Array.from({ length: count }, (_, i) => items[Math.floor(i * step)])
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index])
      await sleep(15000)
    }
  })
  await Promise.all(workers)
  return results
}

function pct(n: number, d: number) {
  return d === 0 ? 0 : Math.round((n / d) * 1000) / 10
}

export function scoreReconciliation(
  results: { invoiceId: string; status: string }[],
  expected: Map<string, string>,
): EvalMetrics {
  let correct = 0
  let wrongMatched = 0
  let partialCorrect = 0
  let expectedPartial = 0
  let expectedUnmatched = 0

  for (const r of results) {
    const want = expected.get(r.invoiceId)
    if (!want) continue
    if (want === "partial") expectedPartial++
    if (want === "unmatched") expectedUnmatched++
    if (r.status === want) {
      correct++
      if (want === "partial") partialCorrect++
    } else if (r.status === "matched" && want === "unmatched") {
      wrongMatched++
    }
  }

  return {
    accuracy: pct(correct, results.length),
    falsePositiveRate: pct(wrongMatched, Math.max(expectedUnmatched, 1)),
    partialHandling: pct(partialCorrect, Math.max(expectedPartial, 1)),
    precision: 0,
    recall: 0,
    counts: {
      total: results.length,
      correct,
      wrongMatched,
      partialCorrect,
      flaggedViolations: 0,
      trueViolations: 0,
      correctViolations: 0,
    },
  }
}

export function scoreCompliance(
  results: { documentId: string; ruleCode: string; status: string }[],
  expected: Map<string, string[]>,
): EvalMetrics {
  let flagged = 0
  let correctViolations = 0
  let trueViolations = 0

  for (const r of results) {
    const want = expected.get(r.documentId) || []
    if (want.includes(r.ruleCode)) trueViolations++
    if (r.status === "violation") {
      flagged++
      if (want.includes(r.ruleCode)) correctViolations++
    }
  }

  return {
    accuracy: 0,
    falsePositiveRate: 0,
    partialHandling: 0,
    precision: pct(correctViolations, Math.max(flagged, 1)),
    recall: pct(correctViolations, Math.max(trueViolations, 1)),
    counts: {
      total: results.length,
      correct: correctViolations,
      wrongMatched: 0,
      partialCorrect: 0,
      flaggedViolations: flagged,
      trueViolations,
      correctViolations,
    },
  }
}

async function evalReconciliation() {
  console.log("\n=== Reconciliation eval ===")
  console.log("Running baseline matcher over all invoices...")
  const baselineCount = await runBaselineReconciliationAll()
  console.log(`Baseline done: ${baselineCount} invoices`)

  let agentRan = false
  if (WITH_AGENT) {
    const invoices = await prisma.invoice.findMany({
      select: { id: true, number: true },
      orderBy: { number: "asc" },
    })
    const done = new Set(
      (
        await prisma.matchResult.findMany({
          where: { engine: "agent" },
          select: { invoiceId: true },
        })
      ).map((m) => m.invoiceId),
    )
    const pending = FORCE ? invoices : invoices.filter((i) => !done.has(i.id))
    const todo = SAMPLE > 0 ? evenlySpaced(pending, SAMPLE) : pending
    console.log(
      `Running agent over ${todo.length}/${invoices.length} invoices (${agentModelId()}, concurrency ${CONCURRENCY}${SAMPLE > 0 ? ", sampled" : ""})...`,
    )
    let doneCount = 0
    await mapPool(todo, CONCURRENCY, async (inv) => {
      try {
        await withRetry(() => runReconciliationAgent(inv.id))
        agentRan = true
      } catch (e) {
        console.error(`  agent failed for ${inv.number}:`, e instanceof Error ? e.message : e)
      }
      doneCount++
      if (doneCount % 5 === 0 || doneCount === todo.length) {
        console.log(`  ${doneCount}/${todo.length}`)
      }
    })
  } else {
    console.log("Skipping agent run (pass --with-agent or set RUN_AGENT_EVAL=1)")
  }

  // When the agent ran on a subset, compare both engines on that same subset
  // for a fair baseline-vs-agent comparison.
  let scopeIds: Set<string> | null = null
  if (WITH_AGENT && agentRan) {
    const agentResults = await prisma.matchResult.findMany({
      where: { engine: "agent" },
      select: { invoiceId: true },
    })
    scopeIds = new Set(agentResults.map((r) => r.invoiceId))
    console.log(`Scoring both engines on the agent-covered subset (${scopeIds.size} invoices).`)
  }

  const invoices = await prisma.invoice.findMany({
    select: { id: true, expectedMatch: true },
    ...(scopeIds ? { where: { id: { in: [...scopeIds] } } } : {}),
  })
  const expected = new Map(invoices.map((i) => [i.id, i.expectedMatch]))

  for (const engine of ["baseline", "agent"] as const) {
    const results = await prisma.matchResult.findMany({
      where: { engine, ...(scopeIds ? { invoiceId: { in: [...scopeIds] } } : {}) },
      select: { invoiceId: true, status: true },
    })
    if (results.length === 0) continue
    const metrics = scoreReconciliation(results, expected)
    await prisma.evalResult.create({
      data: { engine, task: "reconciliation", metrics: metrics as unknown as Prisma.InputJsonValue },
    })
    console.log(
      `\n${engine.toUpperCase()} reconciliation — accuracy ${metrics.accuracy}% | FP rate ${metrics.falsePositiveRate}% | partial handling ${engine === "baseline" ? "N/A" : metrics.partialHandling + "%"} (correct ${metrics.counts.correct}/${metrics.counts.total})`,
    )
  }
  return { baselineCount }
}

async function evalCompliance() {
  console.log("\n=== Compliance eval ===")
  console.log("Running baseline checker over all documents...")
  const baselineCount = await runBaselineComplianceAll()
  console.log(`Baseline done: ${baselineCount} documents`)

  let agentRan = false
  if (WITH_AGENT) {
    const docs = await prisma.policyDocument.findMany({
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    })
    const done = new Set(
      (
        await prisma.complianceResult.findMany({
          where: { engine: "agent" },
          select: { documentId: true },
        })
      ).map((c) => c.documentId),
    )
    const pending = FORCE ? docs : docs.filter((d) => !done.has(d.id))
    const todo = SAMPLE > 0 ? evenlySpaced(pending, Math.min(SAMPLE, pending.length)) : pending
    console.log(`Running agent over ${todo.length}/${docs.length} documents...`)
    let doneCount = 0
    await mapPool(todo, CONCURRENCY, async (d) => {
      try {
        await withRetry(() => runComplianceAgent(d.id))
        agentRan = true
      } catch (e) {
        console.error(`  agent failed for ${d.title}:`, e instanceof Error ? e.message : e)
      }
      doneCount++
      console.log(`  ${doneCount}/${todo.length}`)
    })
  } else {
    console.log("Skipping agent run (pass --with-agent or set RUN_AGENT_EVAL=1)")
  }

  let scopeIds: Set<string> | null = null
  if (WITH_AGENT && agentRan) {
    const agentResults = await prisma.complianceResult.findMany({
      where: { engine: "agent" },
      select: { documentId: true },
    })
    scopeIds = new Set(agentResults.map((r) => r.documentId))
    console.log(`Scoring both engines on the agent-covered subset (${scopeIds.size} documents).`)
  }

  const docs = await prisma.policyDocument.findMany({
    select: { id: true, expectedViolations: true },
    ...(scopeIds ? { where: { id: { in: [...scopeIds] } } } : {}),
  })
  const expected = new Map(docs.map((d) => [d.id, d.expectedViolations]))
  const rules = await prisma.rule.findMany({ select: { id: true, code: true } })
  const ruleCode = new Map(rules.map((r) => [r.id, r.code]))

  for (const engine of ["baseline", "agent"] as const) {
    const results = await prisma.complianceResult.findMany({
      where: { engine, ...(scopeIds ? { documentId: { in: [...scopeIds] } } : {}) },
      select: { documentId: true, ruleId: true, status: true },
    })
    if (results.length === 0) continue
    const metrics = scoreCompliance(
      results.map((r) => ({
        documentId: r.documentId,
        ruleCode: ruleCode.get(r.ruleId) || "",
        status: r.status,
      })),
      expected,
    )
    await prisma.evalResult.create({
      data: { engine, task: "compliance", metrics: metrics as unknown as Prisma.InputJsonValue },
    })
    console.log(
      `\n${engine.toUpperCase()} compliance — precision ${metrics.precision}% | recall ${metrics.recall}% (flagged ${metrics.counts.flaggedViolations}, correct ${metrics.counts.correctViolations}/${metrics.counts.trueViolations} true violations)`,
    )
  }
}

async function main() {
  await evalReconciliation()
  await evalCompliance()
  console.log("\nEval complete — latest results stored in EvalResult and shown at /dashboard/metrics")
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    process.exit(process.exitCode ?? 0)
  })
