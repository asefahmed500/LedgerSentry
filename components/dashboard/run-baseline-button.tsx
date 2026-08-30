"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PlayIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { fetchJson } from "@/components/dashboard/fetch-json"

export function RunBaselineButton({
  endpoint,
  label = "Run baseline",
}: {
  endpoint: string
  label?: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setPending(true)
    setError(null)
    try {
      const body = await fetchJson(endpoint, { method: "POST" })
      if (!body.ok) {
        setError(body.error || "The baseline run failed.")
        return
      }
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={run} disabled={pending}>
        {pending ? <Spinner /> : <PlayIcon />}
        {label}
      </Button>
      {error ? <p className="max-w-64 text-right text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
