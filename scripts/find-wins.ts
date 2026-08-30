import "dotenv/config"

import { prisma } from "../lib/db"

async function main() {
  const rows = await prisma.matchResult.findMany({
    where: { engine: "agent", status: "matched" },
    include: { invoice: { include: { matchResults: true } }, transaction: true },
    take: 200,
  })
  const wins = rows.filter((r) => {
    const baseline = r.invoice.matchResults.find((m) => m.engine === "baseline")
    return baseline && baseline.status === "unmatched"
  })
  for (const w of wins.slice(0, 5)) {
    const baseline = w.invoice.matchResults.find((m) => m.engine === "baseline")
    console.log(
      `${w.invoice.number} | vendor: ${w.invoice.vendor} | baseline: ${baseline?.status} | agent: ${w.status} (${w.confidence}%, ${w.matchType}) | txn: ${w.transaction?.reference} | explanation: ${w.explanation.slice(0, 100)}`,
    )
  }
  await prisma.$disconnect()
  process.exit(0)
}

main()
