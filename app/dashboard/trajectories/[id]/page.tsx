import { notFound } from "next/navigation"

import { getRunWithSteps } from "@/lib/agent/trajectory"
import { formatDateTime } from "@/components/dashboard/format"
import { PageHeader } from "@/components/dashboard/page-header"
import { RunStatusBadge } from "@/components/dashboard/status-badge"
import {
  TrajectoryView,
  type TrajectoryStepView,
} from "@/components/dashboard/trajectory-view"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const dateReplacer = (_key: string, value: unknown) =>
  value instanceof Date ? value.toISOString() : value

function serializeJson(value: unknown): string | null {
  if (value === null || value === undefined) return null
  try {
    return JSON.stringify(value, dateReplacer, 2)
  } catch {
    return String(value)
  }
}

export default async function TrajectoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const run = await getRunWithSteps(id)
  if (!run) notFound()

  const steps: TrajectoryStepView[] = run.steps.map((step) => ({
    index: step.index,
    type: step.type,
    toolName: step.toolName,
    reasoning: step.reasoning,
    input: serializeJson(step.input),
    output: serializeJson(step.output),
  }))

  const durationSeconds =
    run.finishedAt
      ? Math.max(
          0,
          Math.round((run.finishedAt.getTime() - run.startedAt.getTime()) / 1000)
        )
      : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Trajectory"
        description="Step-by-step trace of a single agent run — reasoning, tool calls and the final answer."
      />
      <Card size="sm">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={run.kind === "compliance" ? "secondary" : "outline"}>
              {run.kind}
            </Badge>
            <CardTitle className="font-mono text-sm">{run.model}</CardTitle>
            <RunStatusBadge status={run.status} />
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {formatDateTime(run.startedAt)}
              {run.finishedAt ? ` → ${formatDateTime(run.finishedAt)}` : " → running"}
              {durationSeconds != null ? ` · ${durationSeconds}s` : ""}
            </span>
          </div>
          <CardDescription className="font-mono text-xs">
            run {run.id} · input {run.inputRef}
          </CardDescription>
          {run.error ? (
            <CardDescription className="text-destructive">
              {run.error}
            </CardDescription>
          ) : null}
        </CardHeader>
        {run.output ? (
          <CardContent>
            <pre className="max-h-40 overflow-auto border bg-muted p-3 text-xs">
              {serializeJson(run.output)}
            </pre>
          </CardContent>
        ) : null}
      </Card>
      <TrajectoryView steps={steps} />
    </div>
  )
}
