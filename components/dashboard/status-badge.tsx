import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

function Dot({ className }: { className?: string }) {
  return <span aria-hidden className={cn("size-1.5 shrink-0", className)} />
}

export function MatchStatusBadge({ status }: { status: string }) {
  const variant =
    status === "matched" ? "default" : status === "partial" ? "secondary" : "outline"
  const dot =
    status === "matched"
      ? "bg-primary"
      : status === "partial"
        ? "bg-muted-foreground"
        : "bg-muted-foreground/40"
  return (
    <Badge variant={variant}>
      <Dot className={dot} />
      {status}
    </Badge>
  )
}

export function ComplianceStatusBadge({ status }: { status: string }) {
  const variant =
    status === "violation" ? "destructive" : status === "compliant" ? "secondary" : "outline"
  const dot =
    status === "violation"
      ? "bg-destructive"
      : status === "compliant"
        ? "bg-muted-foreground"
        : "bg-muted-foreground/40"
  return (
    <Badge variant={variant}>
      <Dot className={dot} />
      {status}
    </Badge>
  )
}

export function RunStatusBadge({ status }: { status: string }) {
  const variant =
    status === "complete" ? "secondary" : status === "error" ? "destructive" : "outline"
  const dot =
    status === "complete"
      ? "bg-muted-foreground"
      : status === "error"
        ? "bg-destructive"
        : "bg-primary"
  return (
    <Badge variant={variant}>
      <Dot className={dot} />
      {status}
    </Badge>
  )
}

export function EngineBadge({ engine }: { engine: string }) {
  return (
    <Badge variant={engine === "agent" ? "default" : "outline"}>{engine}</Badge>
  )
}
