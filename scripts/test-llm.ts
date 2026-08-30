import "dotenv/config"

import { generateText } from "ai"

import { agentModel, agentModelId } from "../lib/agent/zhipu"

async function main() {
  console.log("model:", agentModelId())
  const { text, usage } = await generateText({
    model: agentModel(),
    prompt: "Reply with exactly: LEDGERSENTRY-OK",
  })
  console.log("response:", text.trim())
  console.log("tokens:", usage.totalTokens)
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e)
  process.exit(1)
})
