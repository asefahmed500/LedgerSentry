import { prisma } from "@/lib/db"

export function baselineRuleDecision(
  rule: { keywords: string[] },
  documentText: string,
): { status: "compliant" | "violation"; matchedKeyword: string | null } {
  const text = documentText.toLowerCase()
  for (const keyword of rule.keywords) {
    if (text.includes(keyword.toLowerCase())) {
      return { status: "compliant", matchedKeyword: keyword }
    }
  }
  return { status: "violation", matchedKeyword: null }
}

export async function runBaselineCompliance(documentId: string) {
  const doc = await prisma.policyDocument.findUniqueOrThrow({ where: { id: documentId } })
  const rules = await prisma.rule.findMany()

  for (const rule of rules) {
    const decision = baselineRuleDecision(rule, doc.text)
    const explanation = decision.matchedKeyword
      ? `Keyword "${decision.matchedKeyword}" found.`
      : `None of [${rule.keywords.join(", ")}] found in document.`
    await prisma.complianceResult.upsert({
      where: {
        documentId_ruleId_engine: {
          documentId: doc.id,
          ruleId: rule.id,
          engine: "baseline",
        },
      },
      create: {
        documentId: doc.id,
        ruleId: rule.id,
        status: decision.status,
        rationale: explanation,
        confidence: decision.matchedKeyword ? 100 : 100,
        engine: "baseline",
      },
      update: {
        status: decision.status,
        rationale: explanation,
        confidence: 100,
      },
    })
  }

  return prisma.complianceResult.findMany({
    where: { documentId: doc.id, engine: "baseline" },
    include: { rule: true },
  })
}

export async function runBaselineComplianceAll() {
  const docs = await prisma.policyDocument.findMany({ select: { id: true } })
  for (const doc of docs) {
    await runBaselineCompliance(doc.id)
  }
  return docs.length
}
