"use server"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/db"

export interface RuleInput {
  code: string
  category: string
  description: string
  keywords: string
  severity: "critical" | "major" | "minor"
}

function parseKeywords(raw: string) {
  return raw
    .split(/[,\n]/)
    .map((k) => k.trim())
    .filter(Boolean)
}

export async function createRule(input: RuleInput) {
  await prisma.rule.create({
    data: {
      code: input.code.trim(),
      category: input.category.trim(),
      description: input.description.trim(),
      keywords: parseKeywords(input.keywords),
      severity: input.severity,
    },
  })
  revalidatePath("/dashboard/policies")
  revalidatePath("/dashboard/compliance")
}

export async function updateRule(id: string, input: RuleInput) {
  await prisma.rule.update({
    where: { id },
    data: {
      code: input.code.trim(),
      category: input.category.trim(),
      description: input.description.trim(),
      keywords: parseKeywords(input.keywords),
      severity: input.severity,
    },
  })
  revalidatePath("/dashboard/policies")
  revalidatePath("/dashboard/compliance")
}

export async function deleteRule(id: string) {
  await prisma.complianceResult.deleteMany({ where: { ruleId: id } })
  await prisma.rule.delete({ where: { id } })
  revalidatePath("/dashboard/policies")
  revalidatePath("/dashboard/compliance")
}
