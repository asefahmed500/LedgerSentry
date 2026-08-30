import { cn } from "@/lib/utils"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Badge } from "@/components/ui/badge"

export interface TrajectoryStepView {
  index: number
  type: string
  toolName: string | null
  reasoning: string | null
  input: string | null
  output: string | null
}

function typeBadgeVariant(type: string): "default" | "secondary" | "outline" {
  if (type === "reasoning") return "secondary"
  if (type === "final") return "default"
  return "outline"
}

function stepDotClass(type: string) {
  return type === "tool_call" ? "bg-muted-foreground" : "bg-primary"
}

export function TrajectoryView({ steps }: { steps: TrajectoryStepView[] }) {
  if (steps.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>No steps recorded</EmptyTitle>
          <EmptyDescription>
            This run finished before any step was logged.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <ol className="relative flex flex-col gap-6 border-l pl-6">
      {steps.map((step) => (
        <li key={step.index} className="relative flex flex-col gap-2">
          <span
            aria-hidden
            className={cn(
              "absolute top-1 -left-[1.75rem] size-2",
              stepDotClass(step.type)
            )}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={typeBadgeVariant(step.type)}>{step.type}</Badge>
            {step.toolName ? (
              <span className="font-mono text-xs text-muted-foreground">
                {step.toolName}
              </span>
            ) : null}
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              step {step.index}
            </span>
          </div>
          {step.reasoning ? (
            <p className="text-sm italic text-muted-foreground">{step.reasoning}</p>
          ) : null}
          {step.input ? (
            <pre className="max-h-40 overflow-auto border bg-muted p-3 text-xs">
              {step.input}
            </pre>
          ) : null}
          {step.output ? (
            <pre className="max-h-40 overflow-auto border bg-muted p-3 text-xs">
              {step.output}
            </pre>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
