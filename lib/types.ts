export type MatchStatus = "matched" | "partial" | "unmatched"
export type ComplianceStatus = "compliant" | "violation" | "ambiguous"
export type Engine = "baseline" | "agent"
export type ReviewKind = "reconciliation" | "compliance"
export type ReviewStatus = "pending" | "approved" | "rejected"

export interface ExtractedInvoiceFields {
  vendor: string
  invoiceNumber: string
  amount: number
  issueDate: string
  dueDate: string
  source: "vision" | "tesseract" | "database"
  confidence: number
}

export interface FuzzyMatchResult {
  score: number
  verdict: "exact" | "strong" | "moderate" | "weak" | "different"
}

export interface ReconciliationOutput {
  invoiceId: string
  invoiceNumber: string
  status: MatchStatus
  matchType: "exact" | "fuzzy" | "batch" | "partial-payment" | null
  transactionReference: string | null
  amountPaid: number | null
  percentReceived: number | null
  confidence: number
  explanation: string
  needsHumanReview: boolean
}

export interface ComplianceRuleOutcome {
  ruleCode: string
  status: ComplianceStatus
  citedClause: string | null
  rationale: string
  confidence: number
}

export interface ComplianceOutput {
  documentId: string
  title: string
  vendor: string
  outcomes: ComplianceRuleOutcome[]
  needsHumanReview: boolean
  summary: string
}

export interface EvalMetrics {
  accuracy: number
  falsePositiveRate: number
  partialHandling: number
  precision: number
  recall: number
  counts: {
    total: number
    correct: number
    wrongMatched: number
    partialCorrect: number
    flaggedViolations: number
    trueViolations: number
    correctViolations: number
  }
}
