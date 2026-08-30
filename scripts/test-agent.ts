import "dotenv/config"

import { prisma } from "../lib/db"
import { runReconciliationAgent } from "../lib/agent/reconciliation"

async function main() {
  const invoice = await prisma.invoice.findFirst({
    where: { isScanned: true, expectedMatch: { in: ["matched", "partial"] } },
    select: { id: true, number: true, vendor: true, amount: true },
  })
  if (!invoice) throw new Error("no scanned invoice found")
  console.log("running agent on:", invoice.number, invoice.vendor, Number(invoice.amount))

  const out = await runReconciliationAgent(invoice.id)
  console.log("DECISION:", JSON.stringify(out, null, 2))

  const run = await prisma.agentRun.findFirst({
    where: { kind: "reconciliation", inputRef: invoice.id },
    orderBy: { startedAt: "desc" },
    include: { steps: { orderBy: { index: "asc" } } },
  })
  console.log("\nTRAJECTORY:", run?.status, `${run?.steps.length} steps, model ${run?.model}`)
  for (const s of run?.steps ?? []) {
    console.log(`  [${s.index}] ${s.type}${s.toolName ? ` ${s.toolName}` : ""}`)
  }
}

main()
  .catch((e) => {
    console.error("FAILED:", e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
