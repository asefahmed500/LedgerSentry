import Link from "next/link"

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
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/dashboard/page-header"
import { MatchStatusBadge } from "@/components/dashboard/status-badge"
import { formatBDT, formatDate } from "@/components/dashboard/format"
import { prisma } from "@/lib/db"
import { ArrowRightIcon, FileBarChartIcon } from "lucide-react"

export const dynamic = "force-dynamic"

const complianceVariant = {
  compliant: "secondary",
  violation: "destructive",
  ambiguous: "outline",
} as const

export default async function ReportsPage() {
  const matchResults = await prisma.matchResult.findMany({
    where: { engine: "agent" },
    include: { invoice: true, transaction: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  const docs = await prisma.policyDocument.findMany({
    include: {
      results: {
        where: { engine: "agent" },
        include: { rule: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
  const reviewedDocs = docs.filter((d) => d.results.length > 0)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Reports"
        description="Agent findings across every document that has been run — reconciliation decisions and compliance reviews with evidence."
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Reconciliation reports</h2>
        {matchResults.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia>
                <FileBarChartIcon />
              </EmptyMedia>
              <EmptyTitle>No agent runs yet</EmptyTitle>
              <EmptyDescription>
                Run the agent on an invoice from the Reconciliation page — its
                decision, confidence and explanation appear here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead className="w-36">Confidence</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Explanation</TableHead>
                  <TableHead className="text-right">Trajectory</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matchResults.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">
                      {r.invoice.number}
                      <span className="block text-muted-foreground">
                        {formatBDT(Number(r.invoice.amount))}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-40 truncate">
                      {r.invoice.vendor}
                    </TableCell>
                    <TableCell>
                      <MatchStatusBadge status={r.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={r.confidence} className="h-1.5" />
                        <span className="text-xs text-muted-foreground">
                          {r.confidence}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.transaction ? (
                        <>
                          <span className="font-mono">{r.transaction.reference}</span>
                          <span className="block text-muted-foreground">
                            {formatBDT(Number(r.transaction.amount))} ·{" "}
                            {formatDate(r.transaction.date)}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {r.explanation}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.runId ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          render={<Link href={`/dashboard/trajectories/${r.runId}`} />}
                        >
                          Open
                          <ArrowRightIcon data-icon="inline-end" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Compliance reports</h2>
        {reviewedDocs.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia>
                <FileBarChartIcon />
              </EmptyMedia>
              <EmptyTitle>No compliance reviews yet</EmptyTitle>
              <EmptyDescription>
                Run the agent on a PO from the Compliance page — rule-by-rule
                outcomes with clause citations appear here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {reviewedDocs.map((doc) => {
              const violations = doc.results.filter((r) => r.status === "violation")
              const ambiguous = doc.results.filter((r) => r.status === "ambiguous")
              return (
                <Card key={doc.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">
                          {doc.title}
                          <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
                            {doc.vendor}
                          </span>
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {violations.length} violation{violations.length === 1 ? "" : "s"} ·{" "}
                          {ambiguous.length} ambiguous ·{" "}
                          {doc.results.length - violations.length - ambiguous.length} compliant
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {[...violations, ...ambiguous].length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Fully compliant — no violations or ambiguous rules.
                      </p>
                    ) : (
                      [...violations, ...ambiguous].slice(0, 4).map((r) => (
                        <div key={r.id} className="flex flex-col gap-1 border-l-2 border-l-primary pl-3">
                          <div className="flex items-center gap-2">
                            <Badge variant={complianceVariant[r.status as keyof typeof complianceVariant]}>
                              {r.rule.code} · {r.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {r.confidence}%
                            </span>
                          </div>
                          {r.citedClause ? (
                            <p className="text-xs italic text-muted-foreground">
                              &ldquo;{r.citedClause}&rdquo;
                            </p>
                          ) : null}
                          <p className="text-xs">{r.rationale}</p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
