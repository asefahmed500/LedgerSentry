import Image from "next/image"
import { CheckIcon, XIcon } from "lucide-react"

import { approveReviewItem, rejectReviewItem } from "@/app/dashboard/actions"
import { formatBDT, formatDate, formatDateTime } from "@/components/dashboard/format"
import {
  ComplianceStatusBadge,
  MatchStatusBadge,
} from "@/components/dashboard/status-badge"
import { PdfViewer } from "@/components/dashboard/pdf-viewer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export interface ReviewCardItem {
  id: string
  kind: string
  reason: string
  status: string
  decidedBy: string | null
  decidedAt: Date | null
  createdAt: Date
}

export interface ReviewCardReconciliation {
  status: string
  matchType: string | null
  confidence: number
  explanation: string
  invoice: {
    number: string
    vendor: string
    amount: number
    dueDate: Date
    imagePath: string | null
  }
  transaction: {
    reference: string
    payer: string
    amount: number
    date: Date
    channel: string
  } | null
}

export interface ReviewCardCompliance {
  document: { id: string; title: string; vendor: string; pdfPath: string | null }
  outcomes: Array<{
    id: string
    ruleCode: string
    ruleDescription: string
    status: string
    citedClause: string | null
    rationale: string
    confidence: number
  }>
}

function EvidenceField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="truncate text-sm">{children}</span>
    </div>
  )
}

function ReconciliationEvidence({
  data,
}: {
  data: ReviewCardReconciliation | null | undefined
}) {
  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">
        The referenced match result no longer exists.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <MatchStatusBadge status={data.status} />
        {data.matchType ? <Badge variant="outline">{data.matchType}</Badge> : null}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          confidence {data.confidence}%
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="flex flex-col gap-2 border bg-section-alt p-3">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Invoice
          </span>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold">{data.invoice.number}</span>
            <span className="text-sm tabular-nums">
              {formatBDT(data.invoice.amount)}
            </span>
          </div>
          <span className="truncate text-sm text-muted-foreground">
            {data.invoice.vendor}
          </span>
          <span className="text-xs text-muted-foreground">
            Due {formatDate(data.invoice.dueDate)}
          </span>
          {data.invoice.imagePath ? (
            <Image
              src={data.invoice.imagePath}
              alt={`Scan of invoice ${data.invoice.number}`}
              width={320}
              height={420}
              className="h-auto w-full border"
            />
          ) : null}
        </div>
        <div className="flex items-center gap-2 md:flex-col" aria-hidden>
          <span className="h-px flex-1 bg-border md:h-auto md:w-px md:flex-none md:flex-1" />
          <span className="text-xs font-medium text-muted-foreground">vs</span>
          <span className="h-px flex-1 bg-border md:h-auto md:w-px md:flex-none md:flex-1" />
        </div>
        <div className="flex flex-col gap-2 border bg-section-alt p-3">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Payment
          </span>
          {data.transaction ? (
            <>
              <EvidenceField label="Reference">
                <span className="font-mono text-xs">{data.transaction.reference}</span>
              </EvidenceField>
              <EvidenceField label="Payer">{data.transaction.payer}</EvidenceField>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-muted-foreground">Amount</span>
                <span className="text-sm font-medium tabular-nums">
                  {formatBDT(data.transaction.amount)}
                </span>
              </div>
              <EvidenceField label="Date">
                {formatDate(data.transaction.date)}
              </EvidenceField>
              <EvidenceField label="Channel">{data.transaction.channel}</EvidenceField>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No transaction linked.</p>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          Agent explanation
        </span>
        <p className="text-sm leading-relaxed">{data.explanation}</p>
      </div>
    </div>
  )
}

function ComplianceEvidence({
  data,
}: {
  data: ReviewCardCompliance | null | undefined
}) {
  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">
        The referenced policy document no longer exists.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-mono text-xs">
          {data.document.title}
        </Badge>
        <span className="ml-auto truncate text-xs text-muted-foreground">
          {data.document.vendor}
        </span>
      </div>
      {data.document.pdfPath ? <PdfViewer url={data.document.pdfPath} /> : null}
      <div className="flex flex-col">
        <span className="text-xs font-medium text-muted-foreground">
          Agent outcomes
        </span>
        {data.outcomes.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            No agent outcomes recorded for this document.
          </p>
        ) : (
          data.outcomes.map((outcome) => (
            <div
              key={outcome.id}
              className="flex flex-col gap-2 py-3 [&:not(:first-child)]:border-t"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {outcome.ruleCode}
                </Badge>
                <span className="min-w-0 flex-1 text-sm">
                  {outcome.ruleDescription}
                </span>
                <ComplianceStatusBadge status={outcome.status} />
              </div>
              {outcome.citedClause ? (
                <blockquote className="border-l-2 border-primary pl-3 text-sm italic text-muted-foreground">
                  “{outcome.citedClause}”
                </blockquote>
              ) : null}
              <p className="text-sm text-muted-foreground">{outcome.rationale}</p>
              <span className="text-xs text-muted-foreground tabular-nums">
                confidence {outcome.confidence}%
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function ReviewCard({
  item,
  reconciliation,
  compliance,
}: {
  item: ReviewCardItem
  reconciliation?: ReviewCardReconciliation | null
  compliance?: ReviewCardCompliance | null
}) {
  const title =
    item.kind === "reconciliation"
      ? (reconciliation?.invoice.number ?? "Reconciliation")
      : (compliance?.document.title ?? "Compliance")

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={item.kind === "reconciliation" ? "secondary" : "outline"}>
            {item.kind}
          </Badge>
          <CardTitle className="min-w-0 truncate">{title}</CardTitle>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
            {formatDateTime(item.createdAt)}
          </span>
        </div>
        <CardDescription>
          <span className="block border-l-2 border-primary pl-3 text-sm italic">
            “{item.reason}”
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {item.kind === "reconciliation" ? (
          <ReconciliationEvidence data={reconciliation} />
        ) : (
          <ComplianceEvidence data={compliance} />
        )}
      </CardContent>
      <CardFooter>
        {item.status === "pending" ? (
          <div className="flex w-full justify-end gap-2">
            <form action={approveReviewItem.bind(null, item.id)}>
              <Button type="submit" size="sm">
                <CheckIcon />
                Approve
              </Button>
            </form>
            <form action={rejectReviewItem.bind(null, item.id)}>
              <Button type="submit" variant="destructive" size="sm">
                <XIcon />
                Reject
              </Button>
            </form>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {item.status} by {item.decidedBy ?? "unknown"} ·{" "}
            {item.decidedAt ? formatDateTime(item.decidedAt) : "no timestamp"}
          </p>
        )}
      </CardFooter>
    </Card>
  )
}
