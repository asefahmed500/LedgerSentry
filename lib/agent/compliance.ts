import { generateText, hasToolCall, stepCountIs } from "ai"
import type { Prisma } from "@/generated/client"

import { prisma } from "@/lib/db"
import { agentModel, agentModelId, confidenceThreshold } from "@/lib/agent/zhipu"
import { buildComplianceTools, type ToolContext } from "@/lib/agent/tools"
import { failRun, finishRun, logStep, startRun } from "@/lib/agent/trajectory"
import type { ComplianceOutput } from "@/lib/types"

const SYSTEM_PROMPT = `You are LedgerSentry, a procurement-compliance review agent. You are given one purchase order / contract document and the company rulebook. For EVERY rule in the rulebook you must decide: compliant, violation, or ambiguous — citing the exact clause from the document.

Your procedure:
1. Call lookup_rulebook to fetch all rules (and their categories if you want to focus).
2. Read the document text carefully. Rules can be expressed in different wording than the rulebook — judge intent and substance, not keywords. Example: "cleared within one month" substantially satisfies a 30-day payment term; "Net 60" violates it.
3. For each rule:
   - compliant: the document satisfies the rule's intent. Quote the clause verbatim in citedClause.
   - violation: the document clearly conflicts with the rule. Quote the offending clause verbatim. A MISSING required clause is also a violation (cite null and say "clause absent").
   - ambiguous: the wording makes the outcome genuinely unclear (implied terms, vague thresholds, conflicts between clauses). Quote the vague clause and explain both readings. Route these to the flag_for_human_review tool once per document.
   citedClause MUST be copied character-for-character from the DOCUMENT TEXT above — never paraphrased or reconstructed. If OCR noise garbles a quote, quote it as-is and note the noise in the rationale.
4. Never auto-flag a violation without quoted evidence. When in doubt between violation and ambiguous, choose ambiguous.
5. Confidence per outcome: clear quote, clear rule = 90-99. Wording differs but substance clear = 75-89. Genuinely unclear = 40-70.
6. Finish by calling submit_compliance_review exactly once with one outcome per rule, needsHumanReview true if any outcome is ambiguous or below ${confidenceThreshold()} confidence.

Evaluate ALL rules — no skipping.`

export async function runComplianceAgent(documentId: string): Promise<ComplianceOutput> {
  const doc = await prisma.policyDocument.findUniqueOrThrow({ where: { id: documentId } })

  if (doc.text.trim().length < 40) {
    throw new Error(
      "This document has no readable text (likely an unreadable scan). Recover the text before running the compliance agent.",
    )
  }

  const run = await startRun("compliance", agentModelId(), documentId)
  const ctx: ToolContext = { runId: run.id, stepCounter: { value: 0 } }

  try {
    await logStep(run.id, ctx.stepCounter.value++, {
      type: "reasoning",
      reasoning: `Reviewing ${doc.title} from ${doc.vendor} against the rulebook (${doc.text.length} chars).`,
    })

    const tools = buildComplianceTools(ctx)
    const result = await generateText({
      model: agentModel(),
      maxRetries: 5,
      system: SYSTEM_PROMPT,
      prompt: `Review this purchase order for compliance:
Document ID: ${doc.id}
Title: ${doc.title}
Vendor: ${doc.vendor}

DOCUMENT TEXT:
---
${doc.text}
---`,
      tools,
      stopWhen: [stepCountIs(10), hasToolCall("submit_compliance_review")],
    })

    const submitCall = result.steps
      .flatMap((s) => s.toolCalls)
      .find((c) => c.toolName === "submit_compliance_review")

    if (!submitCall) {
      throw new Error("Agent finished without submitting a review")
    }

    const output = submitCall.input as ComplianceOutput
    output.documentId = doc.id
    output.title = doc.title
    output.vendor = doc.vendor
    output.needsHumanReview =
      output.needsHumanReview ||
      output.outcomes.some(
        (o) => o.status === "ambiguous" || o.confidence < confidenceThreshold(),
      )

    const rules = await prisma.rule.findMany()
    const ruleByCode = new Map(rules.map((r) => [r.code, r]))

    for (const outcome of output.outcomes) {
      const rule = ruleByCode.get(outcome.ruleCode)
      if (!rule) continue
      await prisma.complianceResult.upsert({
        where: {
          documentId_ruleId_engine: {
            documentId: doc.id,
            ruleId: rule.id,
            engine: "agent",
          },
        },
        create: {
          documentId: doc.id,
          ruleId: rule.id,
          status: outcome.status,
          citedClause: outcome.citedClause,
          rationale: outcome.rationale,
          confidence: Math.round(outcome.confidence),
          engine: "agent",
          runId: run.id,
        },
        update: {
          status: outcome.status,
          citedClause: outcome.citedClause,
          rationale: outcome.rationale,
          confidence: Math.round(outcome.confidence),
          runId: run.id,
        },
      })
    }

    if (output.needsHumanReview) {
      const existing = await prisma.reviewItem.findFirst({
        where: { kind: "compliance", refId: doc.id, status: "pending" },
      })
      if (!existing) {
        await prisma.reviewItem.create({
          data: {
            kind: "compliance",
            refId: doc.id,
            reason: `Ambiguous or low-confidence outcomes — ${output.summary}`,
          },
        })
      }
    }

    await finishRun(run.id, output as unknown as Prisma.InputJsonValue)
    return output
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await failRun(run.id, message)
    throw error
  }
}
