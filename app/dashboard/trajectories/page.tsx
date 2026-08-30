export const dynamic = "force-dynamic"

import Link from "next/link"
import { prisma } from "@/lib/db"
import { formatDateTime } from "@/components/dashboard/format"
import { PageHeader } from "@/components/dashboard/page-header"
import { RunStatusBadge } from "@/components/dashboard/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dash } from "@/components/dashboard/dash"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default async function TrajectoriesPage() {
  const runs = await prisma.agentRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 30,
    include: { _count: { select: { steps: true } } },
  })

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
        title="Trajectories"
        description="The last 30 agent runs with their full reasoning and tool-call trace."
      />
      {runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No agent runs recorded yet.</p>
      ) : (
        <div className="overflow-x-auto border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kind</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Input</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Finished</TableHead>
                <TableHead className="text-right">Steps</TableHead>
                <TableHead className="text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>
                    <Badge variant={run.kind === "compliance" ? "secondary" : "outline"}>
                      {run.kind}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{run.model}</TableCell>
                  <TableCell className="max-w-48 truncate">
                    {labelById.get(run.inputRef) ?? run.inputRef}
                  </TableCell>
                  <TableCell>
                    <RunStatusBadge status={run.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatDateTime(run.startedAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {run.finishedAt ? formatDateTime(run.finishedAt) : <Dash />}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {run._count.steps}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      render={<Link href={`/dashboard/trajectories/${run.id}`} />}
                    >
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
