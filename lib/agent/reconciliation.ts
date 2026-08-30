import { generateText, hasToolCall, stepCountIs } from "ai"
import type { Prisma } from "@/generated/client"

import { prisma } from "@/lib/db"
import { agentModel, agentModelId, confidenceThreshold } from "@/lib/agent/zhipu"
import { buildReconciliationTools, type ToolContext } from "@/lib/agent/tools"
import { failRun, finishRun, logStep, startRun } from "@/lib/agent/trajectory"
import type { ReconciliationOutput } from "@/lib/types"

const SYSTEM_PROMPT = `You are LedgerSentry, a meticulous accounts-reconciliation agent. You are given one invoice and must determine what happened to its payment using ONLY the tools provided. Never invent data.

Authoritative data: the invoice facts in the task message come from the ledger record that a human entered or verified. Treat them as ground truth. The extract_document_fields tool reads the scanned image — use it as corroborating evidence only. If OCR disagrees with the ledger record (garbled vendor, wrong amount), trust the ledger record, mention the discrepancy in your explanation, and lower your confidence accordingly.

Your procedure:
1. Get the invoice facts. If the invoice is a scanned image, call extract_document_fields first and compare against the ledger record.
2. Find candidate payments with lookup_transaction. Search by payer substring and a date window around the invoice due date (due date ± 7 days is a good start). Broaden with amount tolerance when needed.
3. If a payer string differs from the invoice vendor, call fuzzy_match_vendor to score it. Scores >= 85 are strong; 70-84 need corroborating evidence (amount + date); below 70 usually means no reliable match.
4. Decide:
   - matched: one transaction covers the invoice (amount within ~1%, or an explained tolerance) — matchType "exact" or "fuzzy".
   - matched with matchType "batch": several invoices were settled by ONE transaction. Verify the sum of the related invoices equals the transaction amount within ~1% before claiming this.
   - partial: the transaction clearly relates to this invoice but covers only part of it — set percentReceived.
   - unmatched: no plausible transaction exists. Say what you searched for.
5. Confidence (0-100): exact amount + exact vendor + date in window = 95-99. Fuzzy name resolved = 80-93. Batch sum verified = 85-95. Partial = 80-90. Ambiguous evidence, ledger/OCR conflict, or low OCR confidence = 50-74.
6. If confidence < ${confidenceThreshold()} or evidence is contradictory, you MUST call flag_for_human_review, then submit with needsHumanReview: true. Never guess.
7. Finish by calling submit_reconciliation_result exactly once with a plain-language explanation that cites the concrete evidence (transaction reference, amount difference, fuzzy score, dates).

Work efficiently: typically 2-5 tool calls are enough.`

export async function runReconciliationAgent(invoiceId: string): Promise<ReconciliationOutput> {
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })
  const run = await startRun("reconciliation", agentModelId(), invoiceId)
  const ctx: ToolContext = { runId: run.id, stepCounter: { value: 0 } }

  try {
    await logStep(run.id, ctx.stepCounter.value++, {
      type: "reasoning",
      reasoning: `Investigating invoice ${invoice.number} from ${invoice.vendor}, amount ${invoice.amount} BDT, due ${invoice.dueDate.toISOString().slice(0, 10)}.`,
    })

    const tools = buildReconciliationTools(ctx)
    const result = await generateText({
      model: agentModel(),
      system: SYSTEM_PROMPT,
      prompt: `Reconcile this invoice:
Invoice ID: ${invoice.id}
Invoice Number: ${invoice.number}
Vendor: ${invoice.vendor}
Amount (BDT): ${Number(invoice.amount)}
Issue date: ${invoice.issueDate.toISOString().slice(0, 10)}
Due date: ${invoice.dueDate.toISOString().slice(0, 10)}
Scanned image: ${invoice.isScanned ? `yes (${invoice.imagePath})` : "no"}`,
      tools,
      stopWhen: [stepCountIs(14), hasToolCall("submit_reconciliation_result")],
    })

    const submitCall = result.steps
      .flatMap((s) => s.toolCalls)
      .find((c) => c.toolName === "submit_reconciliation_result")

    if (!submitCall) {
      throw new Error("Agent finished without submitting a result")
    }

    const output = submitCall.input as ReconciliationOutput
    output.invoiceId = invoice.id
    output.invoiceNumber = invoice.number
    output.needsHumanReview =
      output.needsHumanReview || output.confidence < confidenceThreshold()

    const transaction = output.transactionReference
      ? await prisma.transaction.findUnique({ where: { reference: output.transactionReference } })
      : null

    const matchResult = await prisma.matchResult.upsert({
      where: { invoiceId_engine: { invoiceId: invoice.id, engine: "agent" } },
      create: {
        invoiceId: invoice.id,
        transactionId: transaction?.id ?? null,
        status: output.status,
        matchType: output.matchType,
        confidence: Math.round(output.confidence),
        explanation: output.explanation,
        engine: "agent",
        runId: run.id,
      },
      update: {
        transactionId: transaction?.id ?? null,
        status: output.status,
        matchType: output.matchType,
        confidence: Math.round(output.confidence),
        explanation: output.explanation,
        runId: run.id,
      },
    })

    if (output.needsHumanReview) {
      const existing = await prisma.reviewItem.findFirst({
        where: { kind: "reconciliation", refId: matchResult.id, status: "pending" },
      })
      if (!existing) {
        await prisma.reviewItem.create({
          data: {
            kind: "reconciliation",
            refId: matchResult.id,
            reason: `Confidence ${output.confidence}% below threshold — ${output.explanation}`,
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
