import Link from "next/link"

import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/db"
import type { EvalMetrics } from "@/lib/types"

async function latestMetrics() {
  const rows = await prisma.evalResult.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
  })
  const map = new Map<string, EvalMetrics>()
  for (const row of rows) {
    const key = `${row.engine}:${row.task}`
    if (!map.has(key)) map.set(key, row.metrics as unknown as EvalMetrics)
  }
  return map
}

export async function MetricsStrip() {
  const map = await latestMetrics()

  const metrics = [
    {
      label: "Match accuracy",
      description: "matched correctly vs ground truth",
      task: "reconciliation" as const,
      value: (m: EvalMetrics) => `${m.accuracy}%`,
      skipBaseline: false,
    },
    {
      label: "False-positive rate",
      description: "wrongly auto-matched — the costly failure",
      task: "reconciliation" as const,
      value: (m: EvalMetrics) => `${m.falsePositiveRate}%`,
      skipBaseline: false,
    },
    {
      label: "Partial/batch handling",
      description: "split and batched settlements identified",
      task: "reconciliation" as const,
      value: (m: EvalMetrics) => `${m.partialHandling}%`,
      skipBaseline: true,
    },
    {
      label: "Compliance precision",
      description: "of flagged violations, actually violations",
      task: "compliance" as const,
      value: (m: EvalMetrics) => `${m.precision}%`,
      skipBaseline: false,
    },
    {
      label: "Compliance recall",
      description: "of actual violations caught",
      task: "compliance" as const,
      value: (m: EvalMetrics) => `${m.recall}%`,
      skipBaseline: false,
    },
  ]

  const hasAny = [...map.keys()].length > 0

  return (
    <section id="metrics" className="border-b bg-background py-20 md:py-28">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6">
        <h2 className="text-3xl font-semibold md:text-4xl">
          Measured, not vibes.
        </h2>
        <p className="max-w-2xl text-muted-foreground">
          Baseline and agent score the same dataset. These are the live
          numbers from the last eval run.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {metrics.map((metric) => {
            const baseline = map.get(`baseline:${metric.task}`)
            const agent = map.get(`agent:${metric.task}`)
            return (
              <div
                key={metric.label}
                className="flex flex-col gap-1 border bg-card p-5"
              >
                <p className="font-mono text-2xl font-semibold">
                  {hasAny
                    ? `${metric.skipBaseline || !baseline ? "—" : metric.value(baseline)} → ${agent ? metric.value(agent) : "—"}`
                    : "—"}
                </p>
                <p className="text-sm font-medium">{metric.label}</p>
                <p className="text-xs text-muted-foreground">
                  {metric.description}
                </p>
                <p className="mt-auto pt-3 text-xs text-muted-foreground">
                  baseline → agent
                </p>
              </div>
            )
          })}
          <div className="flex flex-col items-start gap-4 border bg-card p-5 sm:col-span-2 lg:col-span-5 lg:flex-row lg:items-center lg:justify-between">
            <p className="max-w-2xl text-sm text-muted-foreground">
              Every number comes from{" "}
              <span className="font-mono text-foreground">npm run eval</span>{" "}
              against the seeded dataset — rerun it any time.
            </p>
            <Button variant="outline" size="lg" render={<Link href="/dashboard/metrics" />}>
              See the harness
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
