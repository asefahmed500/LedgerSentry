import {
  ArrowRightIcon,
  CheckIcon,
  ClipboardCheckIcon,
  FileSearchIcon,
  PlayIcon,
  QuoteIcon,
  ShieldXIcon,
  SparklesIcon,
  UserCheckIcon,
} from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/db"
import { fuzzyMatchVendor } from "@/lib/fuzzy"
import { cn } from "@/lib/utils"

const trustItems = [
  { icon: SparklesIcon, label: "Confidence-scored decisions" },
  { icon: UserCheckIcon, label: "Human review queue" },
  { icon: FileSearchIcon, label: "Tool-call audit trail" },
]

async function getHeroData() {
  const matched = await prisma.matchResult.findFirst({
    where: { engine: "agent", status: { in: ["matched", "partial"] } },
    include: { invoice: true, transaction: true },
    orderBy: { createdAt: "desc" },
  })

  const invoice = matched?.invoice ?? (await prisma.invoice.findFirst({ orderBy: { createdAt: "asc" } }))
  const transaction =
    matched?.transaction ??
    (invoice ? await prisma.transaction.findFirst({ orderBy: { createdAt: "asc" } }) : null)

  const lastRun = await prisma.agentRun.findFirst({
    where: { status: "complete" },
    orderBy: { startedAt: "desc" },
    include: { steps: { where: { type: { in: ["tool_call", "final"] } }, orderBy: { index: "asc" }, take: 3 } },
  })

  const violation = await prisma.complianceResult.findFirst({
    where: { engine: "agent", status: "violation" },
    include: { rule: true, document: true },
  })

  const pendingReviews = await prisma.reviewItem.count({ where: { status: "pending" } })

  return {
    match: invoice
      ? {
          invoiceNumber: invoice.number,
          vendor: invoice.vendor,
          amount: Number(invoice.amount),
          transactionRef: transaction?.reference ?? "TXN#----",
          payer: transaction?.payer ?? "—",
          fuzzyScore:
            invoice && transaction ? fuzzyMatchVendor(invoice.vendor, transaction.payer).score : 0,
          confidence: matched?.confidence ?? 0,
          status: matched?.status ?? "pending",
          hasAgentRun: Boolean(matched),
        }
      : null,
    tools: lastRun?.steps.map((s) => s.toolName).filter(Boolean).slice(0, 3) ?? [],
    violation: violation
      ? {
          document: violation.document.title,
          ruleCode: violation.rule.code,
          citedClause: violation.citedClause?.slice(0, 120) ?? null,
        }
      : null,
    pendingReviews,
  }
}

function FloatCard({
  className,
  delay,
  children,
}: {
  className?: string
  delay?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn("absolute hidden w-72 lg:block", className)}>
      <div
        className={cn(
          delay ? "animate-hero-float-delayed" : "animate-hero-float",
          "motion-reduce:animate-none",
        )}
      >
        {children}
      </div>
    </div>
  )
}

export async function Hero() {
  const data = await getHeroData()
  const amount = data.match
    ? data.match.amount.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "—"

  return (
    <section className="relative overflow-hidden border-b pb-24 pt-32 md:pb-32 md:pt-44">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:56px_56px] opacity-60 [mask-image:radial-gradient(ellipse_75%_65%_at_50%_0%,black_20%,transparent_75%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-primary/5 [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />

      {data.match ? (
        <FloatCard className="left-6 top-40 -rotate-3 xl:left-16">
          <div className="border border-l-4 border-l-primary bg-card p-4 shadow-xl shadow-foreground/5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">Live reconciliation</p>
              <span className="size-1.5 animate-pulse bg-primary motion-reduce:animate-none" />
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3 border px-2.5 py-1.5">
                <p className="min-w-0 truncate text-xs">
                  <span className="font-medium">{data.match.invoiceNumber}</span>{" "}
                  <span className="text-muted-foreground">{data.match.vendor}</span>
                </p>
                <p className="shrink-0 font-mono text-xs text-muted-foreground">{amount}</p>
              </div>
              <div className="flex items-center justify-between gap-3 border px-2.5 py-1.5">
                <p className="min-w-0 truncate text-xs">
                  <span className="font-medium">{data.match.transactionRef}</span>{" "}
                  <span className="text-muted-foreground">{data.match.payer}</span>
                </p>
                <p className="shrink-0 font-mono text-xs text-muted-foreground">{amount}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs font-semibold">
                {data.match.hasAgentRun ? data.match.status.toUpperCase() : "READY"}
              </p>
              <Badge variant="secondary" className="text-[11px]">
                fuzzy {data.match.fuzzyScore}
              </Badge>
            </div>
            <div className="mt-2 h-1 bg-muted">
              <div
                className="h-full bg-primary"
                style={{ width: `${data.match.hasAgentRun ? data.match.confidence : 0}%` }}
              />
            </div>
          </div>
        </FloatCard>
      ) : null}

      {data.tools.length > 0 ? (
        <FloatCard className="right-6 top-36 rotate-2 xl:right-16" delay>
          <div className="border bg-card p-4 shadow-xl shadow-foreground/5">
            <p className="font-mono text-[11px] text-muted-foreground">
              agent trajectory · {data.tools.length} tools
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {data.tools.map((tool) => (
                <div key={tool} className="flex items-center gap-2">
                  <CheckIcon className="size-3.5 shrink-0 text-primary" />
                  <p className="truncate font-mono text-xs">{tool}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 border-t pt-2">
              <PlayIcon className="size-3 text-muted-foreground" />
              <p className="text-[11px] text-muted-foreground">
                every call logged with evidence
              </p>
            </div>
          </div>
        </FloatCard>
      ) : null}

      {data.violation ? (
        <FloatCard className="bottom-14 left-10 rotate-2 xl:left-24" delay>
          <div className="border bg-card p-4 shadow-xl shadow-foreground/5">
            <div className="flex items-center gap-2">
              <ShieldXIcon className="size-4 text-destructive" />
              <p className="font-mono text-xs font-medium">
                {data.violation.ruleCode} · VIOLATION
              </p>
            </div>
            <div className="mt-2 flex gap-1.5 border-l-2 border-l-destructive pl-2">
              <QuoteIcon className="size-3 shrink-0 text-muted-foreground" />
              <p className="line-clamp-2 text-[11px] italic text-muted-foreground">
                {data.violation.citedClause || "Required clause absent from the document"}
              </p>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {data.violation.document}
            </p>
          </div>
        </FloatCard>
      ) : null}

      <FloatCard className="bottom-20 right-12 -rotate-2 xl:right-28">
        <div className="border bg-card p-4 shadow-xl shadow-foreground/5">
          <div className="flex items-center gap-2">
            <ClipboardCheckIcon className="size-4 text-primary" />
            <p className="text-xs font-medium">Review queue</p>
          </div>
          <p className="mt-1 text-2xl font-semibold">{data.pendingReviews}</p>
          <p className="text-[11px] text-muted-foreground">
            ambiguous decisions waiting on a human
          </p>
        </div>
      </FloatCard>

      <div className="relative mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-6 text-center">
        <Badge>AI agents for finance ops</Badge>
        <h1 className="text-balance text-4xl font-semibold md:text-6xl">
          Reconcile the books.{" "}
          <span className="text-muted-foreground">Enforce the contract.</span>
        </h1>
        <p className="max-w-xl text-balance text-lg text-muted-foreground">
          The agent matches real payments to invoices and checks every PO
          clause — with a confidence score on every decision.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" render={<Link href="/register" />}>
            Start free
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
          <Button size="lg" variant="outline" render={<a href="#agents-demo" />}>
            See a live run
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {trustItems.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <item.icon className="size-3.5" />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
