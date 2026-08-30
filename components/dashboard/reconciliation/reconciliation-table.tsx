"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { ExternalLinkIcon, FileImageIcon, Link2Icon } from "lucide-react"

import { formatBDT } from "@/components/dashboard/format"
import { MatchStatusBadge } from "@/components/dashboard/status-badge"
import { ReconciliationRunButton } from "@/components/dashboard/reconciliation/reconciliation-run-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export interface ReconciliationAgentInfo {
  status: string
  confidence: number
  matchType: string | null
  explanation: string
  transactionReference: string | null
  transactionAmount: number | null
  fuzzyScore: number | null
  fuzzyVerdict: string | null
  runId: string | null
}

export interface ReconciliationPoInfo {
  title: string
  violations: number
  ambiguous: number
  reviewed: boolean
}

export interface ReconciliationRow {
  invoiceId: string
  number: string
  vendor: string
  amount: number
  isScanned: boolean
  baselineStatus: string | null
  po: ReconciliationPoInfo | null
  agent: ReconciliationAgentInfo | null
}

function Dash() {
  return <span className="text-muted-foreground">—</span>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="truncate text-sm">{children}</div>
    </div>
  )
}

function DetailsDialog({ row }: { row: ReconciliationRow }) {
  const agent = row.agent
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Details
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invoice details — {row.number}</DialogTitle>
          <DialogDescription>
            {agent
              ? "How the agent resolved this invoice against the payment ledger."
              : "Ledger record. Run the agent to reconcile it against payments."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {agent ? (
            <>
              <p className="text-sm leading-relaxed">{agent.explanation}</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Status">
                  <MatchStatusBadge status={agent.status} />
                </Field>
                <Field label="Match type">
                  {agent.matchType ? (
                    <Badge variant="secondary">{agent.matchType}</Badge>
                  ) : (
                    <Dash />
                  )}
                </Field>
                <Field label="Transaction">
                  {agent.transactionReference ? (
                    <span className="font-mono text-xs">
                      {agent.transactionReference}
                    </span>
                  ) : (
                    <Dash />
                  )}
                </Field>
                <Field label="Amount paid">
                  {agent.transactionAmount != null ? (
                    formatBDT(agent.transactionAmount)
                  ) : (
                    <Dash />
                  )}
                </Field>
                <Field label="Fuzzy vendor score">
                  {agent.fuzzyVerdict ? (
                    <span>
                      {agent.fuzzyScore}/100 · {agent.fuzzyVerdict}
                    </span>
                  ) : (
                    <Dash />
                  )}
                </Field>
                <Field label="Confidence">
                  <span className="tabular-nums">{agent.confidence}%</span>
                </Field>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Confidence
                </span>
                <Progress value={agent.confidence} />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vendor">
                {row.vendor}
              </Field>
              <Field label="Amount">
                {formatBDT(row.amount)}
              </Field>
              <Field label="Baseline">
                {row.baselineStatus ? (
                  <MatchStatusBadge status={row.baselineStatus} />
                ) : (
                  "not run"
                )}
              </Field>
              <Field label="Agent">
                {row.agent ? (
                  <MatchStatusBadge status={row.agent.status} />
                ) : (
                  "not run"
                )}
              </Field>
            </div>
          )}
          {row.po ? (
            <div className="flex items-center justify-between gap-3 border bg-muted/40 p-3">
              <div className="flex min-w-0 flex-col">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Link2Icon className="size-3.5" />
                  Linked PO
                </span>
                <span className="truncate text-sm font-medium">{row.po.title}</span>
                <span className="text-xs text-muted-foreground">
                  {row.po.reviewed
                    ? `${row.po.violations} violation${row.po.violations === 1 ? "" : "s"} · ${row.po.ambiguous} ambiguous`
                    : "not reviewed yet — run the compliance agent"}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                render={<Link href="/dashboard/compliance" />}
              >
                Check PO
              </Button>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          {agent?.runId ? (
            <Button
              variant="outline"
              render={<Link href={`/dashboard/trajectories/${agent.runId}`} />}
            >
              <ExternalLinkIcon />
              View trajectory
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function statusOf(row: ReconciliationRow) {
  return row.agent?.status ?? row.baselineStatus
}

const filters = ["all", "matched", "partial", "unmatched", "scanned"] as const

export function ReconciliationTable({ rows }: { rows: ReconciliationRow[] }) {
  const [filter, setFilter] = useState<string>("all")

  const counts = {
    all: rows.length,
    matched: rows.filter((row) => statusOf(row) === "matched").length,
    partial: rows.filter((row) => statusOf(row) === "partial").length,
    unmatched: rows.filter((row) => statusOf(row) === "unmatched").length,
    scanned: rows.filter((row) => row.isScanned).length,
  }

  const filtered = rows.filter((row) => {
    if (filter === "all") return true
    if (filter === "scanned") return row.isScanned
    return statusOf(row) === filter
  })

  if (rows.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileImageIcon />
          </EmptyMedia>
          <EmptyTitle>No invoices in the ledger</EmptyTitle>
          <EmptyDescription>
            Seed the database first — invoices appear here for matching.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Tabs value={filter} onValueChange={(value) => setFilter(String(value))}>
        <TabsList>
          {filters.map((name) => (
            <TabsTrigger key={name} value={name}>
              {name}
              <span className="text-xs text-muted-foreground tabular-nums">
                {counts[name]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="overflow-x-auto border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Scanned</TableHead>
              <TableHead>Baseline</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => (
              <TableRow key={row.invoiceId}>
                <TableCell className="font-medium">{row.number}</TableCell>
                <TableCell className="max-w-48 truncate text-muted-foreground">
                  {row.vendor}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBDT(row.amount)}
                </TableCell>
                <TableCell>
                  {row.isScanned ? (
                    <Badge variant="outline">
                      <FileImageIcon />
                      scan
                    </Badge>
                  ) : (
                    <Dash />
                  )}
                </TableCell>
                <TableCell>
                  {row.baselineStatus ? (
                    <MatchStatusBadge status={row.baselineStatus} />
                  ) : (
                    <Dash />
                  )}
                </TableCell>
                <TableCell>
                  {row.agent ? (
                    <div className="flex items-center gap-2">
                      <MatchStatusBadge status={row.agent.status} />
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {row.agent.confidence}%
                      </span>
                    </div>
                  ) : (
                    <Dash />
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <ReconciliationRunButton invoiceId={row.invoiceId} />
                    <DetailsDialog row={row} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Empty className="border-dashed">
                    <EmptyHeader>
                      <EmptyTitle>Nothing under this filter</EmptyTitle>
                      <EmptyDescription>
                        No invoices are currently in the “{filter}” state.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
