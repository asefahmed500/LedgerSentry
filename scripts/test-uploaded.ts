import "dotenv/config"

import { prisma } from "../lib/db"
import { runReconciliationAgent } from "../lib/agent/reconciliation"
import { runComplianceAgent } from "../lib/agent/compliance"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function throttled(e: unknown) {
  const m = e instanceof Error ? e.message : String(e)
  return /rate limit|overloaded|temporarily|429|503|ENOTFOUND|timeout/i.test(m)
}

async function retry<T>(fn: () => Promise<T>, what: string): Promise<T> {
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      return await fn()
    } catch (e) {
      if (attempt === 6 || !throttled(e)) throw e
      const delay = 45000 * attempt
      console.log(`  throttled — waiting ${delay / 1000}s (attempt ${attempt}/6)`)
      await sleep(delay)
    }
  }
  throw new Error(`unreachable: ${what}`)
}

async function main() {
  const [what] = process.argv.slice(2)

  if (what === "invoice") {
    const inv = await prisma.invoice.findFirst({
      where: { imagePath: { contains: "/uploads/" } },
      include: { po: true },
      orderBy: { createdAt: "desc" },
    })
    if (!inv) throw new Error("no uploaded invoice found")
    console.log(`agent on UPLOADED invoice ${inv.number} (${inv.vendor}, ${Number(inv.amount)} BDT, linked PO: ${inv.po?.title ?? "none"})`)
    const out = await retry(() => runReconciliationAgent(inv.id), "invoice agent")
    console.log("DECISION:", JSON.stringify(out, null, 2))
  } else if (what === "po") {
    const docs = await prisma.policyDocument.findMany({
      where: { title: { startsWith: "PO-UPLOAD" } },
      orderBy: { createdAt: "asc" },
    })
    for (const doc of docs) {
      console.log(`\nagent on UPLOADED PO ${doc.title} (${doc.vendor}, ${doc.text.trim().split(/\s+/).length} words)`)
      try {
        const out = await retry(() => runComplianceAgent(doc.id), `po ${doc.title}`)
        const byStatus = out.outcomes.reduce<Record<string, number>>((acc, o) => {
          acc[o.status] = (acc[o.status] ?? 0) + 1
          return acc
        }, {})
        console.log("SUMMARY:", out.summary.slice(0, 300))
        console.log("COUNTS:", byStatus, "| needsHumanReview:", out.needsHumanReview)
        for (const o of out.outcomes.filter((o) => o.status !== "compliant")) {
          console.log(`  ${o.ruleCode} ${o.status} (${o.confidence}%): ${o.rationale.slice(0, 120)}`)
          if (o.citedClause) console.log(`    quote: "${o.citedClause.slice(0, 120)}"`)
        }
      } catch (e) {
        console.error("  failed:", e instanceof Error ? e.message : e)
      }
    }
  } else {
    throw new Error("pass 'invoice' or 'po'")
  }

  process.exit(0)
}

main()
  .catch((e) => {
    console.error("FAILED:", e instanceof Error ? e.message : e)
    process.exit(1)
  })
