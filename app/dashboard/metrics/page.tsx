export const dynamic = "force-dynamic"

import { prisma } from "@/lib/db"
import type { EvalMetrics } from "@/lib/types"
import { formatDate } from "@/components/dashboard/format"
import { PageHeader } from "@/components/dashboard/page-header"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { FlaskConicalIcon } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface MetricsView {
  accuracy: number
  falsePositiveRate: number
  partialHandling: number
  precision: number
  recall: number
  counts: EvalMetrics["counts"] | null
}

interface EvalEntry {
  engine: string
  task: string
  createdAt: Date
  metrics: MetricsView
}

const metricRows: Array<{
  label: string
  key: keyof Omit<MetricsView, "counts">
}> = [
  { label: "Match accuracy", key: "accuracy" },
  { label: "False-positive rate", key: "falsePositiveRate" },
  { label: "Partial/batch handling", key: "partialHandling" },
  { label: "Compliance precision", key: "precision" },
  { label: "Compliance recall", key: "recall" },
]

function toMetricsView(value: unknown): MetricsView | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<EvalMetrics>
  if (typeof raw.accuracy !== "number") return null
  return {
    accuracy: raw.accuracy,
    falsePositiveRate: typeof raw.falsePositiveRate === "number" ? raw.falsePositiveRate : 0,
    partialHandling: typeof raw.partialHandling === "number" ? raw.partialHandling : 0,
    precision: typeof raw.precision === "number" ? raw.precision : 0,
    recall: typeof raw.recall === "number" ? raw.recall : 0,
    counts: raw.counts ?? null,
  }
}

function formatMetric(value: number): string {
  const pct = value <= 1 ? value * 100 : value
  return `${Math.round(pct * 10) / 10}%`
}

function formatCounts(counts: EvalMetrics["counts"] | null): string | null {
  if (!counts) return null
  return Object.entries(counts)
    .map(([key, value]) => `${key} ${value}`)
    .join(" · ")
}

function MetricCell({
  entry,
  metricKey,
}: {
  entry: EvalEntry | null
  metricKey: keyof Omit<MetricsView, "counts">
}) {
  if (!entry) {
    return <TableCell><span className="text-muted-foreground">—</span></TableCell>
  }
  const countsLine = formatCounts(entry.metrics.counts)
  return (
    <TableCell>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm tabular-nums">
          {formatMetric(entry.metrics[metricKey])}
        </span>
        {countsLine ? (
          <span className="text-xs text-muted-foreground">{countsLine}</span>
        ) : null}
      </div>
    </TableCell>
  )
}

export default async function MetricsPage() {
  const results = await prisma.evalResult.findMany({
    orderBy: { createdAt: "desc" },
    take: 12,
  })

  const latest = new Map<string, EvalEntry>()
  for (const row of results) {
    const metrics = toMetricsView(row.metrics)
    if (!metrics) continue
    const key = `${row.engine}:${row.task}`
    if (!latest.has(key)) {
      latest.set(key, {
        engine: row.engine,
        task: row.task,
        createdAt: row.createdAt,
        metrics,
      })
    }
  }

  function pick(engine: string): EvalEntry | null {
    for (const task of ["reconciliation", "compliance"]) {
      const hit = latest.get(`${engine}:${task}`)
      if (hit) return hit
    }
    for (const entry of latest.values()) {
      if (entry.engine === engine) return entry
    }
    return null
  }

  const baseline = pick("baseline")
  const agent = pick("agent")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Metrics"
        description="Baseline versus agent on the evaluation suite — the PRD §7 comparison."
      />
      {latest.size === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FlaskConicalIcon />
            </EmptyMedia>
            <EmptyTitle>No eval runs yet — run `npm run eval`.</EmptyTitle>
            <EmptyDescription>
              The evaluation harness compares both engines and stores per-run metrics
              here.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <pre className="w-full overflow-auto border bg-muted p-3 text-left text-xs">
              npm run eval
            </pre>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="overflow-x-auto border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead>
                  <span className="flex flex-col">
                    Baseline
                    {baseline ? (
                      <span className="text-xs font-normal text-muted-foreground">
                        {baseline.task} · {formatDate(baseline.createdAt)}
                      </span>
                    ) : null}
                  </span>
                </TableHead>
                <TableHead>
                  <span className="flex flex-col">
                    Agent
                    {agent ? (
                      <span className="text-xs font-normal text-muted-foreground">
                        {agent.task} · {formatDate(agent.createdAt)}
                      </span>
                    ) : null}
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metricRows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <MetricCell entry={baseline} metricKey={row.key} />
                  <MetricCell entry={agent} metricKey={row.key} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
