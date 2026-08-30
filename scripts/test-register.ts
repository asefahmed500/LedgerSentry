import "dotenv/config"

import bcrypt from "bcryptjs"

import { prisma } from "../lib/db"

async function main() {
  const email = `probe-${Date.now()}@test.local`
  console.log("creating user:", email)
  const user = await prisma.user.create({
    data: {
      name: "Probe Tester",
      email,
      passwordHash: await bcrypt.hash("password123", 10),
    },
    select: { id: true, name: true, email: true },
  })
  console.log("created:", user)
  await prisma.user.delete({ where: { id: user.id } })
  console.log("cleanup ok")
}

main()
  .catch((e) => {
    console.error("FAILED:", e instanceof Error ? `${e.name}: ${e.message}` : e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
