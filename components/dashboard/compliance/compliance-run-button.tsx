"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PlayIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { fetchJson } from "@/components/dashboard/fetch-json"

export function ComplianceRunButton({ documentId }: { documentId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setPending(true)
    setError(null)
    try {
      const body = await fetchJson("/api/agents/compliance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentId }),
      })
      if (!body.ok) {
        setError(body.error || "The agent run failed.")
        return
      }
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="outline" size="sm" onClick={run} disabled={pending}>
        {pending ? <Spinner /> : <PlayIcon />}
        {pending ? "Agent working…" : "Run agent"}
      </Button>
      {error ? <p className="max-w-56 text-left text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
