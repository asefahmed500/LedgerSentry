import "dotenv/config"

import { prisma } from "../lib/db"

async function main() {
  const agentMatches = await prisma.matchResult.count({ where: { engine: "agent" } })
  const agentCompliance = await prisma.complianceResult.count({ where: { engine: "agent" } })
  const errorRuns = await prisma.agentRun.count({ where: { status: "error" } })
  const completeRuns = await prisma.agentRun.count({ where: { status: "complete" } })
  console.log({ agentMatches, agentCompliance, errorRuns, completeRuns })
  await prisma.$disconnect()
  process.exit(0)
}

main()
