import "dotenv/config"

import { prisma } from "../lib/db"

async function main() {
  const id = "cmtfnck840006qgfwt6ck2ffe"
  const po = await prisma.policyDocument.findUnique({ where: { id } })
  console.log(po ? `exists: ${po.title} (${po.vendor})` : "DELETED — not in database")
  const count = await prisma.policyDocument.count()
  console.log("total POs:", count)
  await prisma.$disconnect()
  process.exit(0)
}

main()
