import type { Prisma } from "@/generated/client"
import { prisma } from "@/lib/db"

type AgentRunModel = {
  id: string
  kind: string
  model: string
  inputRef: string
}

export async function startRun(
  kind: "reconciliation" | "compliance",
  model: string,
  inputRef: string,
): Promise<AgentRunModel> {
  const run = await prisma.agentRun.create({
    data: { kind, model, inputRef },
    select: { id: true, kind: true, model: true, inputRef: true },
  })
  return run
}

export interface StepInput {
  type: "reasoning" | "tool_call" | "final"
  toolName?: string
  input?: Prisma.InputJsonValue
  output?: Prisma.InputJsonValue
  reasoning?: string
}

export async function logStep(runId: string, index: number, step: StepInput) {
  await prisma.agentStep.create({
    data: {
      runId,
      index,
      type: step.type,
      toolName: step.toolName,
      input: step.input,
      output: step.output,
      reasoning: step.reasoning,
    },
  })
}

export async function finishRun(runId: string, output: Prisma.InputJsonValue) {
  await prisma.agentRun.update({
    where: { id: runId },
    data: {
      status: "complete",
      output,
      finishedAt: new Date(),
    },
  })
}

export async function failRun(runId: string, error: string) {
  await prisma.agentRun.update({
    where: { id: runId },
    data: {
      status: "error",
      error,
      finishedAt: new Date(),
    },
  })
}

export async function getRunWithSteps(runId: string) {
  return prisma.agentRun.findUnique({
    where: { id: runId },
    include: { steps: { orderBy: { index: "asc" } } },
  })
}
