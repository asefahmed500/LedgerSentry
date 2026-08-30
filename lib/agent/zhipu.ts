import { createZhipu } from "zhipu-ai-provider"

const baseURL = process.env.ZHIPU_BASE_URL || "https://api.z.ai/api/paas/v4"

export const zhipu = createZhipu({
  apiKey: process.env.ZHIPU_API_KEY || "",
  baseURL,
})

export function agentModelId() {
  return process.env.ZHIPU_MODEL || "glm-5.3-flash"
}

export function visionModelId() {
  return process.env.ZHIPU_VISION_MODEL || "glm-5.3-flash"
}

export function reasoningEffort() {
  return (process.env.ZHIPU_REASONING_EFFORT || "low") as
    | "max"
    | "xhigh"
    | "high"
    | "medium"
    | "low"
    | "minimal"
    | "none"
}

function modelOptions(modelId: string) {
  if (/^glm-5\.\d/i.test(modelId)) {
    return { reasoningEffort: reasoningEffort() }
  }
  if (/^glm-5/i.test(modelId)) {
    return { thinking: { type: "disabled" as const } }
  }
  return {}
}

export function agentModel() {
  const id = agentModelId()
  return zhipu(id, modelOptions(id))
}

export function visionModel() {
  const id = visionModelId()
  return zhipu(id, modelOptions(id))
}

export function confidenceThreshold() {
  return Number(process.env.AGENT_CONFIDENCE_THRESHOLD || 75)
}
