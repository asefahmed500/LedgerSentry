"use server"

import { revalidatePath } from "next/cache"

import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function approveReviewItem(id: string) {
  const user = await getCurrentUser()
  await prisma.reviewItem.update({
    where: { id },
    data: {
      status: "approved",
      decidedAt: new Date(),
      decidedBy: user?.email || "reviewer",
    },
  })
  revalidatePath("/dashboard/review")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/reports")
}

export async function rejectReviewItem(id: string) {
  const user = await getCurrentUser()
  await prisma.reviewItem.update({
    where: { id },
    data: {
      status: "rejected",
      decidedAt: new Date(),
      decidedBy: user?.email || "reviewer",
    },
  })
  revalidatePath("/dashboard/review")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/reports")
}
