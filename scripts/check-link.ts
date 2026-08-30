import "dotenv/config"

import { prisma } from "../lib/db"

async function main() {
  const inv = await prisma.invoice.findFirst({
    where: { vendor: "Green Delta Stationers", imagePath: { contains: "uploads" } },
    include: { po: true },
    orderBy: { createdAt: "desc" },
  })
  console.log(JSON.stringify({ number: inv?.number, linkedPo: inv?.po?.title ?? null }, null, 2))
  await prisma.$disconnect()
  process.exit(0)
}

main()
