import { ArrowRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export function CtaBanner() {
  return (
    <section id="cta" className="py-20 md:py-28">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="flex flex-col items-center gap-5 border bg-card p-10 text-center">
          <h2 className="text-3xl font-semibold md:text-4xl">
            Stop squinting at two PDFs.
          </h2>
          <p className="max-w-md text-muted-foreground">
            Upload a scan, run the agent, judge the confidence yourself.
          </p>
          <Button size="lg" render={<a href="/register" />}>
            Create your workspace
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </section>
  )
}
