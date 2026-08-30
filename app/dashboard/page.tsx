export const dynamic = "force-dynamic"

import Link from "next/link"
import {
  ArrowLeftRightIcon,
  ClipboardCheckIcon,
  GaugeIcon,
  InboxIcon,
  ListTreeIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { prisma } from "@/lib/db"
import { formatBDT, formatDateTime } from "@/components/dashboard/format"
import { PageHeader } from "@/components/dashboard/page-header"
import {
  MatchStatusBadge,
  RunStatusBadge,
} from "@/components/dashboard/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

export default async function OverviewPage() {
  const [invoiceCount, paymentCount, pendingReviews, runCount, runs, matchResults] =
    await Promise.all([
      prisma.invoice.count(),
      prisma.transaction.count(),
      prisma.reviewItem.count({ where: { status: "pending" } }),
      prisma.agentRun.count(),
      prisma.agentRun.findMany({ orderBy: { startedAt: "desc" }, take: 6 }),
      prisma.matchResult.findMany({
        where: { engine: "agent" },
        include: { invoice: true },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
    ])

  if (invoiceCount === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <InboxIcon />
          </EmptyMedia>
          <EmptyTitle>Nothing to reconcile yet</EmptyTitle>
          <EmptyDescription>
            The workspace has no invoices. Seed it with invoices, payments, policy
            documents and the rulebook first.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <pre className="w-full overflow-auto border bg-muted p-3 text-left text-xs">
            npm run db:seed
          </pre>
        </EmptyContent>
      </Empty>
    )
  }

  const invoiceRefs = runs
    .filter((run) => run.kind === "reconciliation")
    .map((run) => run.inputRef)
  const documentRefs = runs
    .filter((run) => run.kind === "compliance")
    .map((run) => run.inputRef)

  const [refInvoices, refDocuments] = await Promise.all([
    invoiceRefs.length
      ? prisma.invoice.findMany({
          where: { id: { in: invoiceRefs } },
          select: { id: true, number: true },
        })
      : Promise.resolve([]),
    documentRefs.length
      ? prisma.policyDocument.findMany({
          where: { id: { in: documentRefs } },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
  ])

  const labelById = new Map<string, string>()
  for (const invoice of refInvoices) labelById.set(invoice.id, invoice.number)
  for (const document of refDocuments) labelById.set(document.id, document.title)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overview"
        description="What the workspace looks like right now — data volume, agent activity and what needs a human."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Invoices" value={invoiceCount} />
        <StatCard label="Payments" value={paymentCount} />
        <StatCard label="Pending reviews" value={pendingReviews} />
        <StatCard label="Agent runs" value={runCount} />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent agent runs</CardTitle>
            <CardDescription>Latest reconciliation and compliance runs.</CardDescription>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <Empty className="border-dashed">
                <EmptyHeader>
                  <EmptyTitle>No agent runs yet</EmptyTitle>
                  <EmptyDescription>
                    Trigger an agent run from the Reconciliation or Compliance pages.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="flex flex-col gap-3">
                {runs.map((run) => (
                  <div key={run.id} className="flex items-center gap-2">
                    <Badge variant={run.kind === "compliance" ? "secondary" : "outline"}>
                      {run.kind}
                    </Badge>
                    <Link
                      href={`/dashboard/trajectories/${run.id}`}
                      className="min-w-0 flex-1 truncate text-sm hover:underline"
                    >
                      {labelById.get(run.inputRef) ?? run.inputRef}
                    </Link>
                    <RunStatusBadge status={run.status} />
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatDateTime(run.startedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent match results</CardTitle>
            <CardDescription>Latest agent verdicts per invoice.</CardDescription>
          </CardHeader>
          <CardContent>
            {matchResults.length === 0 ? (
              <Empty className="border-dashed">
                <EmptyHeader>
                  <EmptyTitle>No agent results yet</EmptyTitle>
                  <EmptyDescription>
                    Run the reconciliation agent on an invoice to see its verdict here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="flex flex-col gap-4">
                {matchResults.map((result) => (
                  <div key={result.id} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {result.invoice.number}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {formatBDT(Number(result.invoice.amount))}
                      </span>
                      <MatchStatusBadge status={result.status} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={result.confidence} className="flex-1" />
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {result.confidence}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
          <CardDescription>Jump straight into a workspace section.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button render={<Link href="/dashboard/reconciliation" />}>
            <ArrowLeftRightIcon />
            Reconciliation
          </Button>
          <Button variant="outline" render={<Link href="/dashboard/compliance" />}>
            <ShieldCheckIcon />
            Compliance
          </Button>
          <Button variant="outline" render={<Link href="/dashboard/review" />}>
            <ClipboardCheckIcon />
            Review queue
          </Button>
          <Button variant="outline" render={<Link href="/dashboard/trajectories" />}>
            <ListTreeIcon />
            Trajectories
          </Button>
          <Button variant="outline" render={<Link href="/dashboard/metrics" />}>
            <GaugeIcon />
            Metrics
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
