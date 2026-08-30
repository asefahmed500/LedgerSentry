export const dynamic = "force-dynamic"

import { prisma } from "@/lib/db"
import { fuzzyMatchVendor } from "@/lib/fuzzy"
import {
  ReconciliationTable,
  type ReconciliationRow,
} from "@/components/dashboard/reconciliation/reconciliation-table"
import { PageHeader } from "@/components/dashboard/page-header"
import { RunBaselineButton } from "@/components/dashboard/run-baseline-button"

export default async function ReconciliationPage() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { number: "asc" },
    include: {
      matchResults: { include: { transaction: true } },
      po: {
        include: { results: { where: { engine: "agent" } } },
      },
    },
  })

  const rows: ReconciliationRow[] = invoices.map((invoice) => {
    const baseline = invoice.matchResults.find((m) => m.engine === "baseline")
    const agent = invoice.matchResults.find((m) => m.engine === "agent")

    let fuzzyScore: number | null = null
    let fuzzyVerdict: string | null = null
    if (agent?.transaction) {
      const fuzzy = fuzzyMatchVendor(invoice.vendorClean, agent.transaction.payer)
      fuzzyScore = fuzzy.score
      fuzzyVerdict = fuzzy.verdict
    }

    return {
      invoiceId: invoice.id,
      number: invoice.number,
      vendor: invoice.vendor,
      amount: Number(invoice.amount),
      isScanned: invoice.isScanned,
      baselineStatus: baseline?.status ?? null,
      po: invoice.po
        ? {
            title: invoice.po.title,
            violations: invoice.po.results.filter((r) => r.status === "violation").length,
            ambiguous: invoice.po.results.filter((r) => r.status === "ambiguous").length,
            reviewed: invoice.po.results.length > 0,
          }
        : null,
      agent: agent
        ? {
            status: agent.status,
            confidence: agent.confidence,
            matchType: agent.matchType,
            explanation: agent.explanation,
            transactionReference: agent.transaction?.reference ?? null,
            transactionAmount: agent.transaction
              ? Number(agent.transaction.amount)
              : null,
            fuzzyScore,
            fuzzyVerdict,
            runId: agent.runId,
          }
        : null,
    }
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reconciliation"
        description="Every invoice against the payment ledger — strict baseline rules on the left, the reasoning agent on the right."
        actions={<RunBaselineButton endpoint="/api/baseline/reconcile" label="Run baseline" />}
      />
      <ReconciliationTable rows={rows} />
    </div>
  )
}
