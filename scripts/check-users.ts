import "dotenv/config"
import { prisma } from "../lib/db"

async function f() {
  const users = await prisma.user.findMany({ select: { email: true } })
  console.log(JSON.stringify(users))
  await prisma.$disconnect()
}
f()
