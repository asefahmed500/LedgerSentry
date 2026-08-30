import "dotenv/config"

import { readFile } from "node:fs/promises"
import path from "node:path"

import { generateText } from "ai"

import { zhipu } from "../lib/agent/zhipu"
import { prisma } from "../lib/db"

async function main() {
  const invoice = await prisma.invoice.findFirst({
    where: { isScanned: true, imagePath: { not: null } },
    select: { id: true, number: true, imagePath: true, vendor: true },
  })
  if (!invoice?.imagePath) throw new Error("no scanned invoice")
  console.log("scan:", invoice.number, invoice.imagePath, "| real vendor:", invoice.vendor)

  const buffer = await readFile(path.join(process.cwd(), "public", invoice.imagePath.replace(/^\//, "")))
  const { text } = await generateText({
    model: zhipu(process.env.ZHIPU_VISION_MODEL || "glm-4.7-flash"),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "What vendor name and total amount do you see on this invoice image? Reply in one short line." },
          { type: "image", image: `data:image/png;base64,${buffer.toString("base64")}` },
        ],
      },
    ],
    maxOutputTokens: 1024,
  })
  console.log("VISION RESPONSE:", text.trim())
}

main()
  .catch((e) => {
    console.error("FAILED:", e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
