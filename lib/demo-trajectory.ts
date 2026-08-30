export interface DemoStep {
  tool: string
  label: string
  detail: string
}

export interface DemoScenario {
  id: "reconciliation" | "compliance"
  tabLabel: string
  title: string
  verdict: string
  confidence: number
  steps: DemoStep[]
}

export const demoScenarios: DemoScenario[] = [
  {
    id: "reconciliation",
    tabLabel: "Reconciliation agent",
    title: "INV-2026-0031 · typo'd vendor + OCR scan",
    verdict: "MATCHED",
    confidence: 87,
    steps: [
      {
        tool: "extract_document_fields",
        label: "Read the scanned invoice",
        detail: "OCR via GLM vision — vendor \u201cABC Trading\u201d, amount 48,250.00 BDT, confidence 62%",
      },
      {
        tool: "fuzzy_match_vendor",
        label: "Resolve the vendor name",
        detail: "\u201cABC Trading\u201d vs \u201cABC Traders Ltd\u201d — score 93 (strong)",
      },
      {
        tool: "lookup_transaction",
        label: "Search the payment feed",
        detail: "TXN#4821 — ABC Trading (BD) · 48,250.00 BDT · paid 1 day before due date",
      },
      {
        tool: "fuzzy_match_vendor",
        label: "Corroborate with amount + date",
        detail: "Amount \u0394 0.0% · date within window — evidence consistent",
      },
      {
        tool: "submit_reconciliation_result",
        label: "Decision",
        detail: "MATCHED — amount exact, fuzzy name resolved, confidence 87%",
      },
    ],
  },
  {
    id: "compliance",
    tabLabel: "Compliance agent",
    title: "PO-2026-006 · hidden liability cap violation",
    verdict: "VIOLATION",
    confidence: 94,
    steps: [
      {
        tool: "lookup_rulebook",
        label: "Load the rulebook",
        detail: "12 procurement rules in scope",
      },
      {
        tool: "lookup_rulebook",
        label: "Focus: liability rules",
        detail: "R-03 — liability cap must be at least 100% of contract value",
      },
      {
        tool: "lookup_transaction",
        label: "Read the PO clauses",
        detail: "\u201cSeller's total liability shall not exceed 50% of the contract value\u201d",
      },
      {
        tool: "submit_compliance_review",
        label: "Cite the conflict",
        detail: "VIOLATION — clause caps liability at 50%, half the required floor",
      },
      {
        tool: "submit_compliance_review",
        label: "Decision",
        detail: "VIOLATION — cited verbatim with the conflicting rule, confidence 94%",
      },
    ],
  },
]
