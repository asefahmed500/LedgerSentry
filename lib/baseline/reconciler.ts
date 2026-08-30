import { prisma } from "@/lib/db"
import { isFuzzyNameMatch } from "@/lib/fuzzy"
import type { MatchStatus } from "@/lib/types"

const AMOUNT_TOLERANCE = 0.01
const DATE_WINDOW_DAYS = 5

function daysBetween(a: Date, b: Date) {
  return Math.abs(a.getTime() - b.getTime()) / 86400000
}

export function baselineMatchDecision(
  invoice: { vendor: string; amount: number; dueDate: Date },
  transactions: { id: string; payer: string; amount: number; date: Date }[],
): { status: MatchStatus; transactionId: string | null } {
  for (const tx of transactions) {
    const amountDiff = Math.abs(tx.amount - invoice.amount) / invoice.amount
    const dateOk = daysBetween(tx.date, invoice.dueDate) <= DATE_WINDOW_DAYS
    const vendorOk =
      tx.payer.toLowerCase().includes(invoice.vendor.toLowerCase()) ||
      isFuzzyNameMatch(tx.payer, invoice.vendor, 97)
    if (amountDiff < AMOUNT_TOLERANCE && dateOk && vendorOk) {
      return { status: "matched", transactionId: tx.id }
    }
  }
  return { status: "unmatched", transactionId: null }
}

export async function runBaselineReconciliation(invoiceId: string) {
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })
  const transactions = await prisma.transaction.findMany()

  const decision = baselineMatchDecision(
    {
      vendor: invoice.vendor,
      amount: Number(invoice.amount),
      dueDate: invoice.dueDate,
    },
    transactions.map((t) => ({
      id: t.id,
      payer: t.payer,
      amount: Number(t.amount),
      date: t.date,
    })),
  )

  return prisma.matchResult.upsert({
    where: { invoiceId_engine: { invoiceId: invoice.id, engine: "baseline" } },
    create: {
      invoiceId: invoice.id,
      transactionId: decision.transactionId,
      status: decision.status,
      confidence: decision.status === "matched" ? 100 : 0,
      explanation:
        decision.status === "matched"
          ? "Exact rule match: amount within 1%, date within 5 days, vendor substring."
          : "No transaction passed the strict rule match.",
      engine: "baseline",
    },
    update: {
      transactionId: decision.transactionId,
      status: decision.status,
      confidence: decision.status === "matched" ? 100 : 0,
      explanation:
        decision.status === "matched"
          ? "Exact rule match: amount within 1%, date within 5 days, vendor substring."
          : "No transaction passed the strict rule match.",
    },
  })
}

export async function runBaselineReconciliationAll() {
  const invoices = await prisma.invoice.findMany({ select: { id: true } })
  for (const inv of invoices) {
    await runBaselineReconciliation(inv.id)
  }
  return invoices.length
}
