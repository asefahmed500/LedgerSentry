import "dotenv/config"

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/client"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

async function main() {
  const removed = await prisma.agentRun.deleteMany({ where: { status: "error" } })
  console.log(`removed ${removed.count} error agent runs`)
}

main()
  .finally(() => prisma.$disconnect())
  .then(() => process.exit(0))
