export const dynamic = "force-dynamic"

import { prisma } from "@/lib/db"
import {
  ComplianceTable,
  type ComplianceRowData,
} from "@/components/dashboard/compliance/compliance-table"
import { PageHeader } from "@/components/dashboard/page-header"
import { RunBaselineButton } from "@/components/dashboard/run-baseline-button"

export default async function CompliancePage() {
  const documents = await prisma.policyDocument.findMany({
    orderBy: { title: "asc" },
    include: { results: { include: { rule: true } } },
  })

  const rows: ComplianceRowData[] = documents.map((doc) => {
    const agent = doc.results.filter((r) => r.engine === "agent")
    const baseline = doc.results.filter((r) => r.engine === "baseline")

    return {
      documentId: doc.id,
      title: doc.title,
      vendor: doc.vendor,
      pdfPath: doc.pdfPath,
      expectedViolations: doc.expectedViolations,
      agentFindings: agent.length
        ? {
            violations: agent.filter((r) => r.status === "violation").length,
            ambiguous: agent.filter((r) => r.status === "ambiguous").length,
            compliant: agent.filter((r) => r.status === "compliant").length,
          }
        : null,
      baselineViolations: baseline.length
        ? baseline.filter((r) => r.status === "violation").length
        : null,
      outcomes: [...baseline, ...agent].map((r) => ({
        id: r.id,
        engine: r.engine,
        ruleCode: r.rule.code,
        ruleDescription: r.rule.description,
        status: r.status,
        citedClause: r.citedClause,
        rationale: r.rationale,
        confidence: r.confidence,
      })),
    }
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Compliance"
        description="Purchase orders checked against the rulebook — a keyword baseline versus the agent's clause-cited review."
        actions={<RunBaselineButton endpoint="/api/baseline/compliance" label="Run baseline" />}
      />
      <ComplianceTable rows={rows} />
    </div>
  )
}
