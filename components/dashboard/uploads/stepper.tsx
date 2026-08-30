"use client"

import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export function Stepper({
  steps,
  current,
}: {
  steps: string[]
  current: number
}) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={label} className="flex items-center gap-2">
            {i > 0 ? (
              <div
                className={cn(
                  "h-px w-8 sm:w-12",
                  done || active ? "bg-primary" : "bg-border",
                )}
              />
            ) : null}
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center border text-xs font-medium",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary text-primary",
                  !done && !active && "border-border text-muted-foreground",
                )}
              >
                {done ? <CheckIcon className="size-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  "hidden text-xs sm:block",
                  active ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
