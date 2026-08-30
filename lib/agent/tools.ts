import { tool } from "ai"
import type { Prisma } from "@/generated/client"
import { z } from "zod"

import { prisma } from "@/lib/db"
import { fuzzyMatchVendor } from "@/lib/fuzzy"
import { extractDocumentFields } from "@/lib/agent/ocr"
import { logStep } from "@/lib/agent/trajectory"

export interface ToolContext {
  runId: string
  stepCounter: { value: number }
}

async function logTool(ctx: ToolContext, toolName: string, input: unknown, output: unknown) {
  const index = ctx.stepCounter.value++
  await logStep(ctx.runId, index, {
    type: "tool_call",
    toolName,
    input: input as Prisma.InputJsonValue,
    output: output as Prisma.InputJsonValue,
  })
}

export function buildReconciliationTools(ctx: ToolContext) {
  return {
    extract_document_fields: tool({
      description:
        "Extract structured fields (vendor, invoice number, amount, dates) from an invoice. Uses vision OCR for scanned invoice images.",
      inputSchema: z.object({
        invoiceId: z.string().describe("ID of the invoice to extract fields from"),
      }),
      execute: async ({ invoiceId }) => {
        const result = await extractDocumentFields(invoiceId, "vision")
        await logTool(ctx, "extract_document_fields", { invoiceId }, result)
        return result
      },
    }),

    fuzzy_match_vendor: tool({
      description:
        "Compare two vendor names and return a similarity score (0-100) with a verdict. Use when the payer string does not exactly match the invoice vendor.",
      inputSchema: z.object({
        name_a: z.string().describe("First vendor name (e.g. from the invoice)"),
        name_b: z.string().describe("Second vendor name (e.g. from the transaction)"),
      }),
      execute: async ({ name_a, name_b }) => {
        const result = fuzzyMatchVendor(name_a, name_b)
        await logTool(ctx, "fuzzy_match_vendor", { name_a, name_b }, result)
        return result
      },
    }),

    lookup_transaction: tool({
      description:
        "Search the synthetic transaction feed for candidate payments. Filter by payer substring, amount proximity, and/or date window.",
      inputSchema: z.object({
        payerContains: z
          .string()
          .optional()
          .describe("Case-insensitive substring of the payer name"),
        amountNear: z.number().optional().describe("Target amount; returns transactions within amountTolerancePct"),
        amountTolerancePct: z.number().optional().describe("Tolerance percentage around amountNear (default 25)"),
        dateFrom: z.string().optional().describe("ISO date — start of the payment date window"),
        dateTo: z.string().optional().describe("ISO date — end of the payment date window"),
        limit: z.number().optional().describe("Max rows to return (default 10)"),
      }),
      execute: async (filters) => {
        const conditions: Prisma.TransactionWhereInput[] = []
        if (filters.payerContains) {
          conditions.push({
            payer: { contains: filters.payerContains, mode: "insensitive" as const },
          })
        }
        if (filters.amountNear) {
          const pct = filters.amountTolerancePct ?? 25
          const delta = (filters.amountNear * pct) / 100
          conditions.push({
            amount: { gte: filters.amountNear - delta, lte: filters.amountNear + delta },
          })
        }
        if (filters.dateFrom || filters.dateTo) {
          conditions.push({
            date: {
              gte: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
              lte: filters.dateTo ? new Date(filters.dateTo) : undefined,
            },
          })
        }
        const results = await prisma.transaction.findMany({
          where: conditions.length ? { AND: conditions } : undefined,
          take: Math.min(filters.limit ?? 10, 25),
          orderBy: { date: "desc" },
        })
        const output = results.map((t) => ({
          id: t.id,
          reference: t.reference,
          payer: t.payer,
          amount: Number(t.amount),
          date: t.date.toISOString().slice(0, 10),
          channel: t.channel,
        }))
        await logTool(ctx, "lookup_transaction", filters, output)
        return output
      },
    }),

    lookup_rulebook: tool({
      description:
        "Look up compliance rules. Pass a clauseType/category to filter, or omit to get the full rulebook.",
      inputSchema: z.object({
        clauseType: z
          .string()
          .optional()
          .describe("Rule category, e.g. payment_terms, liability, delivery, warranty, legal"),
      }),
      execute: async ({ clauseType }) => {
        const rules = await prisma.rule.findMany({
          where: clauseType ? { category: clauseType } : undefined,
        })
        const output = rules.map((r) => ({
          code: r.code,
          category: r.category,
          description: r.description,
          severity: r.severity,
        }))
        await logTool(ctx, "lookup_rulebook", { clauseType }, output)
        return output
      },
    }),

    flag_for_human_review: tool({
      description:
        "Route an item to the human review queue when confidence is low or evidence is ambiguous. Always call this before submitting a low-confidence result.",
      inputSchema: z.object({
        item_ref: z.string().describe("Reference of the item (invoice number or PO title)"),
        reason: z.string().describe("Why this needs human review"),
      }),
      execute: async ({ item_ref, reason }) => {
        const review = await prisma.reviewItem.create({
          data: { kind: "reconciliation", refId: item_ref, reason },
          select: { id: true },
        })
        const output = { reviewId: review.id, routed: true }
        await logTool(ctx, "flag_for_human_review", { item_ref, reason }, output)
        return output
      },
    }),

    submit_reconciliation_result: tool({
      description:
        "Submit the final reconciliation decision for the invoice. This ends the agent run — call it exactly once, after all investigation is done.",
      inputSchema: z.object({
        status: z.enum(["matched", "partial", "unmatched"]),
        matchType: z
          .enum(["exact", "fuzzy", "batch", "partial-payment"])
          .nullable()
          .describe("How the match was made; null when unmatched"),
        transactionReference: z
          .string()
          .nullable()
          .describe("TXN# reference of the matched transaction; null when unmatched"),
        amountPaid: z.number().nullable().describe("Amount received in the matched transaction"),
        percentReceived: z
          .number()
          .nullable()
          .describe("Percentage of the invoice amount received; for partial payments"),
        confidence: z.number().min(0).max(100).describe("Confidence score 0-100"),
        explanation: z
          .string()
          .describe("Plain-language explanation citing the evidence used, e.g. amount difference, fuzzy name score"),
        needsHumanReview: z
          .boolean()
          .describe("True when confidence is below threshold or evidence is ambiguous"),
      }),
      execute: async (output) => {
        const index = ctx.stepCounter.value++
        await logStep(ctx.runId, index, {
          type: "final",
          toolName: "submit_reconciliation_result",
          input: output as Prisma.InputJsonValue,
        })
        return { accepted: true }
      },
    }),
  }
}

export function buildComplianceTools(ctx: ToolContext) {
  const shared = buildReconciliationTools(ctx)
  return {
    lookup_rulebook: shared.lookup_rulebook,
    flag_for_human_review: tool({
      description:
        "Route an item to the human review queue when evidence is ambiguous. Never auto-flag a violation without cited evidence.",
      inputSchema: z.object({
        item_ref: z.string().describe("Reference of the item (PO title)"),
        reason: z.string().describe("Why this needs human review"),
      }),
      execute: async ({ item_ref, reason }) => {
        const review = await prisma.reviewItem.create({
          data: { kind: "compliance", refId: item_ref, reason },
          select: { id: true },
        })
        const output = { reviewId: review.id, routed: true }
        await logTool(ctx, "flag_for_human_review", { item_ref, reason }, output)
        return output
      },
    }),
    submit_compliance_review: tool({
      description:
        "Submit the final compliance review for the document — one outcome per rule. This ends the agent run; call it exactly once.",
      inputSchema: z.object({
        outcomes: z
          .array(
            z.object({
              ruleCode: z.string().describe("Rule code from the rulebook, e.g. R-01"),
              status: z.enum(["compliant", "violation", "ambiguous"]),
              citedClause: z
                .string()
                .nullable()
                .describe("Exact quoted clause from the document the decision is based on; null if the clause is missing"),
              rationale: z.string().describe("One-line rationale"),
              confidence: z.number().min(0).max(100),
            }),
          )
          .describe("One outcome per rulebook rule"),
        summary: z.string().describe("Overall one-paragraph summary for the reviewer"),
        needsHumanReview: z.boolean().describe("True when any rule is ambiguous or confidence is below threshold"),
      }),
      execute: async (output) => {
        const index = ctx.stepCounter.value++
        await logStep(ctx.runId, index, {
          type: "final",
          toolName: "submit_compliance_review",
          input: output as Prisma.InputJsonValue,
        })
        return { accepted: true }
      },
    }),
  }
}
