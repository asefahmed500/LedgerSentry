"use client"

import * as React from "react"
import { CheckIcon, RotateCcwIcon } from "lucide-react"

import { demoScenarios, type DemoScenario } from "@/lib/demo-trajectory"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type ScenarioId = DemoScenario["id"]

const STEP_MS = 700

export function AgentDemo() {
  const [agent, setAgent] = React.useState<ScenarioId>("reconciliation")
  const [runId, setRunId] = React.useState(0)

  const scenario = demoScenarios.find((s) => s.id === agent)!

  return (
    <section id="agents-demo" className="border-b bg-section-alt">
      <div className="py-20 md:py-28">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-6 text-center">
          <Badge variant="outline">The agents</Badge>
          <h2 className="text-3xl font-semibold md:text-4xl">
            One reasoning loop. Two hard jobs.
          </h2>
          <p className="max-w-xl text-muted-foreground">
            The same tool-calling pattern, pointed at two document types.
            Watch the agent collect evidence before it commits to a verdict.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <ToggleGroup
              aria-label="Choose agent run"
              value={[agent]}
              onValueChange={(value) => {
                const next = value[0]
                if (next === "reconciliation" || next === "compliance") {
                  setAgent(next)
                }
              }}
            >
              {demoScenarios.map((s) => (
                <ToggleGroupItem key={s.id} value={s.id}>
                  {s.tabLabel}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
        <div className="mx-auto mt-10 w-full max-w-3xl px-6">
          <div className="border bg-card">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="size-2 bg-muted-foreground/40" />
                <span className="size-2 bg-muted-foreground/40" />
                <span className="size-2 bg-muted-foreground/40" />
              </div>
              <p className="ml-2 font-mono text-xs text-muted-foreground">
                ledgersentry · agent trajectory
              </p>
            </div>
            <div className="px-4 py-4">
              <TrajectoryRun
                key={`${scenario.id}-${runId}`}
                scenario={scenario}
                onReplay={() => setRunId((r) => r + 1)}
              />
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Simulated trace — create a free account to run the real agents on
            your own documents.
          </p>
        </div>
      </div>
    </section>
  )
}

function TrajectoryRun({
  scenario,
  onReplay,
}: {
  scenario: DemoScenario
  onReplay: () => void
}) {
  const [visible, setVisible] = React.useState(0)

  React.useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const raf = requestAnimationFrame(() => setVisible(scenario.steps.length))
      return () => cancelAnimationFrame(raf)
    }
    const id = setInterval(() => {
      setVisible((v) => Math.min(v + 1, scenario.steps.length))
    }, STEP_MS)
    return () => clearInterval(id)
  }, [scenario])

  const done = visible >= scenario.steps.length

  return (
    <div>
      <p className="border-b pb-3 font-mono text-xs text-muted-foreground">
        run: {scenario.title}
      </p>
      <div className="flex flex-col">
        {scenario.steps.map(
          (step, i) =>
            i <= visible && (
              <div
                key={`${scenario.id}-${step.tool}-${i}`}
                className="flex animate-in items-start gap-3 py-2.5 fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none"
              >
                <div className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                  {i < visible ? (
                    <CheckIcon className="size-4 text-primary" />
                  ) : (
                    <Spinner className="size-4 text-primary" />
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="truncate font-mono text-xs text-primary">
                    {step.tool}
                  </p>
                  <p className="text-sm font-medium">{step.label}</p>
                  <p className="text-sm text-muted-foreground">{step.detail}</p>
                </div>
              </div>
            )
        )}
      </div>
      {done ? (
        <div className="mt-4 flex animate-in flex-wrap items-center justify-between gap-4 border-t pt-4 fade-in slide-in-from-bottom-1 duration-500 motion-reduce:animate-none">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">Verdict:</p>
            <p className="text-sm font-semibold text-primary">
              {scenario.verdict}
            </p>
            <Badge>confidence {scenario.confidence}%</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={onReplay}>
            <RotateCcwIcon data-icon="inline-start" />
            Replay
          </Button>
        </div>
      ) : null}
    </div>
  )
}
