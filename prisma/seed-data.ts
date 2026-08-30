export const VENDORS = [
  "ABC Traders Ltd",
  "Rahman & Sons",
  "Dhaka Textiles Mills",
  "Bengal Plastic Works",
  "Meghna Food Products",
  "Padma Printing Press",
  "Chittagong Steel House",
  "Sylhet Tea Estates",
  "Jamuna Hardware",
  "Karnaphuli Paper Mills",
  "Borak Electric Supply",
  "Surma Chemicals",
  "Modhumoti Agro Ltd",
  "Shitalakshya Knitwear",
  "Ahsania Handicrafts",
  "Bay Steels Ltd",
  "Nabila Cosmetics",
  "Rupayan Furniture",
  "Titas Gas Fittings",
  "Green Delta Stationers",
] as const

export const VENDOR_TYPOS: Record<string, string> = {
  "ABC Traders Ltd": "ABC Trading",
  "Rahman & Sons": "Rahaman & Sons",
  "Dhaka Textiles Mills": "Dhaka Textile Mills",
  "Bengal Plastic Works": "Bengal Plastic Work",
  "Sylhet Tea Estates": "Sulhet Tea Estates",
  "Jamuna Hardware": "Jamuna Hardware & Fittings",
  "Karnaphuli Paper Mills": "Karnaphuly Paper Mills",
  "Borak Electric Supply": "Borok Electric Supply",
  "Shitalakshya Knitwear": "Sitalakshya Knitwear",
  "Modhumoti Agro Ltd": "Modhumoti Agro",
}

export const PAYER_PREFIXES = ["M/S ", "", "", "", ""] as const
export const PAYER_SUFFIXES = ["", "", "", " (BD)", "."] as const

export interface RuleSpec {
  code: string
  category: string
  description: string
  keywords: string[]
  severity: "critical" | "major" | "minor"
}

export const RULEBOOK: RuleSpec[] = [
  {
    code: "R-01",
    category: "payment_terms",
    description: "Payment terms must not exceed 30 days.",
    keywords: ["net 30", "30 days"],
    severity: "critical",
  },
  {
    code: "R-02",
    category: "payment_terms",
    description: "Advance payment above 20% requires an escrow arrangement.",
    keywords: ["advance payment", "escrow"],
    severity: "critical",
  },
  {
    code: "R-03",
    category: "liability",
    description: "Liability cap must be at least 100% of contract value.",
    keywords: ["liability", "contract value"],
    severity: "critical",
  },
  {
    code: "R-04",
    category: "delivery",
    description: "Delivery SLA must include liquidated damages for delay.",
    keywords: ["liquidated damages"],
    severity: "major",
  },
  {
    code: "R-05",
    category: "termination",
    description: "Termination notice period must be at least 30 days.",
    keywords: ["terminate", "30 days"],
    severity: "major",
  },
  {
    code: "R-06",
    category: "pricing",
    description: "Price adjustment clause must reference a published index.",
    keywords: ["price adjustment", "index"],
    severity: "minor",
  },
  {
    code: "R-07",
    category: "warranty",
    description: "Minimum warranty period of 12 months.",
    keywords: ["warranty", "12 months", "twelve (12) months"],
    severity: "major",
  },
  {
    code: "R-08",
    category: "legal",
    description: "Governing law must be Bangladesh.",
    keywords: ["governing law", "bangladesh"],
    severity: "major",
  },
  {
    code: "R-09",
    category: "payment_terms",
    description: "Payment must be via bank transfer to the registered account.",
    keywords: ["bank transfer", "registered account"],
    severity: "critical",
  },
  {
    code: "R-10",
    category: "legal",
    description: "Confidentiality period minimum 24 months.",
    keywords: ["confidentiality", "24 months", "twenty-four (24) months"],
    severity: "minor",
  },
  {
    code: "R-11",
    category: "legal",
    description: "A force majeure clause must be present.",
    keywords: ["force majeure"],
    severity: "major",
  },
  {
    code: "R-12",
    category: "delivery",
    description: "Acceptance testing within 15 days of delivery.",
    keywords: ["acceptance testing", "15 days", "fifteen (15) days"],
    severity: "minor",
  },
]

type ClauseMap = Record<string, string>

export const COMPLIANT_CLAUSES: ClauseMap = {
  "R-01": "Payment terms are Net 30 days from the date of a correct invoice.",
  "R-02":
    "No advance payment above 20% of the PO value shall be made except through escrow arrangements approved by both parties.",
  "R-03":
    "The Seller's total liability under this Agreement shall not be limited to less than 100% of the contract value.",
  "R-04":
    "Liquidated damages of 0.5% per week of delay shall apply to late delivery, up to a maximum of 5% of the PO value.",
  "R-05":
    "Either party may terminate this Agreement with thirty (30) days written notice to the other party.",
  "R-06":
    "Price adjustment, where applicable, shall follow the published index of the Bangladesh Bureau of Statistics only.",
  "R-07":
    "A warranty period of twelve (12) months applies from the date of acceptance of the goods.",
  "R-08": "This Agreement shall be governed by the laws of Bangladesh.",
  "R-09":
    "All payments shall be made via bank transfer to the Seller's registered account only.",
  "R-10":
    "Confidentiality obligations survive for twenty-four (24) months after termination of this Agreement.",
  "R-11":
    "Force majeure events shall excuse performance while they persist, provided prompt written notice is given.",
  "R-12":
    "Acceptance testing shall be completed within fifteen (15) days of delivery at the Buyer's site.",
}

export const VIOLATION_CLAUSES: ClauseMap = {
  "R-01": "Payment terms are Net 60 days from invoice receipt.",
  "R-02": "The Buyer shall pay a 50% advance payment upon signing of this Agreement.",
  "R-03":
    "The Seller's total liability under this Agreement shall not exceed 50% of the contract value.",
  "R-04":
    "Delivery shall be made within 45 days of the PO. Penalties for delay are at the sole discretion of the Buyer.",
  "R-05":
    "Either party may terminate this Agreement with fourteen (14) days written notice.",
  "R-06":
    "Prices are fixed for the duration of the contract and may only be revised by mutual written agreement.",
  "R-07": "A warranty period of six (6) months applies from delivery.",
  "R-08": "This Agreement shall be governed by the laws of England and Wales.",
  "R-09":
    "Payments may be made in cash or by cheque handed to the Seller's authorised representative.",
  "R-10":
    "Confidentiality obligations survive for twelve (12) months after termination.",
  "R-11": "",
  "R-12":
    "Acceptance testing shall be completed within forty-five (45) days of delivery.",
}

export const AMBIGUOUS_CLAUSES: ClauseMap = {
  "R-01":
    "Payment shall be cleared within a reasonable period, generally one month from receipt of a correct invoice.",
  "R-02":
    "An advance payment may be required for unusually large orders, subject to the standard safeguards the parties customarily apply.",
  "R-03":
    "The Seller's responsibility shall be limited to amounts actually invoiced, save where the parties agree otherwise in writing.",
  "R-04":
    "Timely delivery is expected under this Agreement; remedies in case of delay shall be discussed between the parties.",
  "R-05":
    "This Agreement may be ended by either party after giving reasonable notice of its intent to do so.",
  "R-06":
    "Prices may be adjusted where market conditions materially change, in line with usual practice.",
  "R-07":
    "Goods are warranted to be free from defects for a period deemed standard for the industry.",
  "R-08":
    "This Agreement shall be interpreted under the laws of the Seller's principal place of business.",
  "R-09":
    "Payments shall be remitted to the Seller's designated account by suitable means agreed between the parties.",
  "R-10":
    "Confidentiality obligations continue for such period as the information remains commercially sensitive.",
  "R-11":
    "Neither party shall be liable for events outside its reasonable control, provided the other party is notified.",
  "R-12":
    "The Buyer shall inspect and test the goods promptly following delivery.",
}

export const PO_SECTION_ORDER = [
  { code: "R-01", heading: "Payment Terms" },
  { code: "R-02", heading: "Advance Payment" },
  { code: "R-03", heading: "Limitation of Liability" },
  { code: "R-04", heading: "Delivery and SLA" },
  { code: "R-05", heading: "Termination" },
  { code: "R-06", heading: "Pricing" },
  { code: "R-07", heading: "Warranty" },
  { code: "R-12", heading: "Inspection and Acceptance" },
  { code: "R-09", heading: "Payment Method" },
  { code: "R-10", heading: "Confidentiality" },
  { code: "R-11", heading: "Force Majeure" },
  { code: "R-08", heading: "Governing Law" },
]

export const PO_PREAMBLE = (vendor: string, po: string) =>
  `Purchase Order ${po} is issued to ${vendor} (the "Seller") for the supply of goods and services described in Schedule A. The following terms form part of this Agreement.`

export const PO_CLOSING =
  "This document, together with its schedules, constitutes the entire agreement between the parties in relation to its subject matter."
