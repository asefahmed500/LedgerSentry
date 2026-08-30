import "dotenv/config"

import { generateText } from "ai"

import { zhipu } from "../lib/agent/zhipu"

const candidates = [
  "glm-4.7-flash",
  "glm-4.5-flash",
  "glm-4-flash",
  "glm-4-flash-250414",
  "glm-5.3-flash",
  "glm-5.3",
  "glm-5.2",
  "glm-5",
  "glm-4.6",
  "glm-4.5-air",
  "glm-4.5v",
  "glm-4.1v-thinking-flash",
]

async function main() {
  for (const id of candidates) {
    process.stdout.write(`${id.padEnd(26)} -> `)
    try {
      const { text } = await generateText({
        model: zhipu(id),
        prompt: "Say OK",
        maxOutputTokens: 512,
      })
      console.log(`WORKS (${text.trim().slice(0, 20)})`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log(`NO (${msg.slice(0, 80)})`)
    }
  }
}

main()
