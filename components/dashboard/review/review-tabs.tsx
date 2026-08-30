"use client"

import { useRouter } from "next/navigation"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const tabs = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
]

export function ReviewTabs({ current }: { current: string }) {
  const router = useRouter()

  return (
    <Tabs
      value={current}
      onValueChange={(value) => {
        const next = String(value)
        router.push(
          next === "pending" ? "/dashboard/review" : `/dashboard/review?status=${next}`
        )
      }}
    >
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
