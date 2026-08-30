"use client"

import { LinkIcon } from "lucide-react"

import { PdfViewer } from "@/components/dashboard/pdf-viewer"
import { ComplianceRunButton } from "@/components/dashboard/compliance/compliance-run-button"
import { ComplianceStatusBadge } from "@/components/dashboard/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export interface ComplianceOutcomeRow {
  id: string
  engine: string
  ruleCode: string
  ruleDescription: string
  status: string
  citedClause: string | null
  rationale: string
  confidence: number
}

export interface ComplianceRowData {
  documentId: string
  title: string
  vendor: string
  pdfPath: string | null
  expectedViolations: string[]
  agentFindings: {
    violations: number
    ambiguous: number
    compliant: number
  } | null
  baselineViolations: number | null
  outcomes: ComplianceOutcomeRow[]
}

function Dash() {
  return <span className="text-muted-foreground">—</span>
}

function PdfDialog({ row }: { row: ComplianceRowData }) {
  if (!row.pdfPath) return <Dash />
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`View PDF of ${row.title}`} />
        }
      >
        <LinkIcon />
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{row.title}</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {row.pdfPath}
          </DialogDescription>
        </DialogHeader>
        <PdfViewer url={row.pdfPath} />
      </DialogContent>
    </Dialog>
  )
}

function OutcomeItem({ outcome }: { outcome: ComplianceOutcomeRow }) {
  return (
    <div className="flex flex-col gap-2 border-b py-4 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono">
          {outcome.ruleCode}
        </Badge>
        <span className="min-w-0 flex-1 text-sm">{outcome.ruleDescription}</span>
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
  )
}

function FindingsDialog({ row }: { row: ComplianceRowData }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Findings
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Findings — {row.title}</DialogTitle>
          <DialogDescription>
            Per-rule outcomes for this document, by engine.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="agent" className="max-h-[60vh] overflow-auto">
          <TabsList>
            <TabsTrigger value="agent">Agent</TabsTrigger>
            <TabsTrigger value="baseline">Baseline</TabsTrigger>
          </TabsList>
          <TabsContent value="agent">
            <div className="flex flex-col">
              {row.outcomes.filter((o) => o.engine === "agent").length === 0 ? (
                <Empty className="border-dashed">
                  <EmptyHeader>
                    <EmptyTitle>No agent run yet</EmptyTitle>
                    <EmptyDescription>
                      Run the compliance agent on this document to get cited outcomes.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                row.outcomes
                  .filter((o) => o.engine === "agent")
                  .map((outcome) => <OutcomeItem key={outcome.id} outcome={outcome} />)
              )}
            </div>
          </TabsContent>
          <TabsContent value="baseline">
            <div className="flex flex-col">
              {row.outcomes.filter((o) => o.engine === "baseline").length === 0 ? (
                <Empty className="border-dashed">
                  <EmptyHeader>
                    <EmptyTitle>No baseline run yet</EmptyTitle>
                    <EmptyDescription>
                      Run the baseline compliance scan to compare.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                row.outcomes
                  .filter((o) => o.engine === "baseline")
                  .map((outcome) => <OutcomeItem key={outcome.id} outcome={outcome} />)
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

export function ComplianceTable({ rows }: { rows: ComplianceRowData[] }) {
  if (rows.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>No policy documents</EmptyTitle>
          <EmptyDescription>
            Seed the database first — purchase orders appear here for review.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="overflow-x-auto border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Document</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>PDF</TableHead>
            <TableHead>Expected violations</TableHead>
            <TableHead>Agent findings</TableHead>
            <TableHead>Baseline findings</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.documentId}>
              <TableCell className="max-w-56 truncate font-medium">{row.title}</TableCell>
              <TableCell className="max-w-48 truncate text-muted-foreground">
                {row.vendor}
              </TableCell>
              <TableCell>
                <PdfDialog row={row} />
              </TableCell>
              <TableCell>
                {row.expectedViolations.length === 0 ? (
                  <span className="text-muted-foreground">none</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {row.expectedViolations.map((code) => (
                      <Badge key={code} variant="outline" className="font-mono">
                        <span aria-hidden className="size-1.5 bg-destructive" />
                        {code}
                      </Badge>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell>
                {row.agentFindings ? (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {row.agentFindings.violations} violations ·{" "}
                    {row.agentFindings.ambiguous} ambiguous ·{" "}
                    {row.agentFindings.compliant} compliant
                  </span>
                ) : (
                  <Dash />
                )}
              </TableCell>
              <TableCell>
                {row.baselineViolations == null ? (
                  <Dash />
                ) : row.baselineViolations > 0 ? (
                  <Badge variant="destructive">
                    {row.baselineViolations} violations
                  </Badge>
                ) : (
                  <Badge variant="secondary">0 violations</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <ComplianceRunButton documentId={row.documentId} />
                  <FindingsDialog row={row} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
