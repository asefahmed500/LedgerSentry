import "dotenv/config"

import { prisma } from "../lib/db"

async function main() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
    take: 6,
    include: { po: { include: { results: { where: { engine: "agent" } } } }, matchResults: true },
  })
  for (const i of invoices) {
    const agent = i.matchResults.find((m) => m.engine === "agent")
    console.log(
      `${i.number} | ${i.vendor} | ${Number(i.amount)} | linked: ${i.po?.title ?? "none"}` +
        ` | po reviewed: ${i.po ? i.po.results.length > 0 : "-"} | agent: ${agent ? `${agent.status} ${agent.confidence}%` : "not run"}`,
    )
  }
  const pos = await prisma.policyDocument.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { results: { where: { engine: "agent" } }, invoices: { select: { number: true } } },
  })
  console.log("---")
  for (const p of pos) {
    console.log(
      `${p.title} | ${p.vendor} | words: ${p.text.trim() ? p.text.trim().split(/\s+/).length : 0} | agent results: ${p.results.length} | linked invoices: ${p.invoices.map((i) => i.number).join(", ") || "none"}`,
    )
  }
  await prisma.$disconnect()
  process.exit(0)
}

main()
