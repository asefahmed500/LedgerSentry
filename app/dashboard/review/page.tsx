import { prisma } from "@/lib/db"
import { PageHeader } from "@/components/dashboard/page-header"
import {
  ReviewCard,
  type ReviewCardCompliance,
  type ReviewCardItem,
  type ReviewCardReconciliation,
} from "@/components/dashboard/review/review-card"
import { ReviewTabs } from "@/components/dashboard/review/review-tabs"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { ClipboardCheckIcon } from "lucide-react"

const emptyCopy: Record<string, { title: string; description: string }> = {
  pending: {
    title: "Queue clear — no ambiguous decisions pending.",
    description: "The agent will route items here whenever confidence drops.",
  },
  approved: {
    title: "Nothing approved yet.",
    description: "Approve pending items to record your decision.",
  },
  rejected: {
    title: "Nothing rejected yet.",
    description: "Reject pending items to record your decision.",
  },
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status: statusParam } = await searchParams
  const status =
    statusParam === "approved" || statusParam === "rejected" ? statusParam : "pending"

  const items = await prisma.reviewItem.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
  })

  const reconciliationRefIds = items
    .filter((item) => item.kind === "reconciliation")
    .map((item) => item.refId)
  const complianceRefIds = items
    .filter((item) => item.kind === "compliance")
    .map((item) => item.refId)

  const [matchResults, documents] = await Promise.all([
    reconciliationRefIds.length
      ? prisma.matchResult.findMany({
          where: { id: { in: reconciliationRefIds } },
          include: { invoice: true, transaction: true },
        })
      : Promise.resolve([]),
    complianceRefIds.length
      ? prisma.policyDocument.findMany({
          where: { id: { in: complianceRefIds } },
          include: { results: { where: { engine: "agent" }, include: { rule: true } } },
        })
      : Promise.resolve([]),
  ])

  const matchById = new Map(matchResults.map((match) => [match.id, match]))
  const documentById = new Map(documents.map((doc) => [doc.id, doc]))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Review queue"
        description="Decisions the agent escalated because the evidence was ambiguous or confidence was low."
      />
      <ReviewTabs current={status} />
      {items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardCheckIcon />
            </EmptyMedia>
            <EmptyTitle>{emptyCopy[status].title}</EmptyTitle>
            <EmptyDescription>{emptyCopy[status].description}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {items.map((item) => {
            const itemData: ReviewCardItem = {
              id: item.id,
              kind: item.kind,
              reason: item.reason,
              status: item.status,
              decidedBy: item.decidedBy,
              decidedAt: item.decidedAt,
              createdAt: item.createdAt,
            }

            let reconciliation: ReviewCardReconciliation | null = null
            let compliance: ReviewCardCompliance | null = null

            if (item.kind === "reconciliation") {
              const match = matchById.get(item.refId)
              if (match) {
                reconciliation = {
                  status: match.status,
                  matchType: match.matchType,
                  confidence: match.confidence,
                  explanation: match.explanation,
                  invoice: {
                    number: match.invoice.number,
                    vendor: match.invoice.vendor,
                    amount: Number(match.invoice.amount),
                    dueDate: match.invoice.dueDate,
                    imagePath: match.invoice.imagePath,
                  },
                  transaction: match.transaction
                    ? {
                        reference: match.transaction.reference,
                        payer: match.transaction.payer,
                        amount: Number(match.transaction.amount),
                        date: match.transaction.date,
                        channel: match.transaction.channel,
                      }
                    : null,
                }
              }
            } else {
              const document = documentById.get(item.refId)
              if (document) {
                compliance = {
                  document: {
                    id: document.id,
                    title: document.title,
                    vendor: document.vendor,
                    pdfPath: document.pdfPath,
                  },
                  outcomes: document.results.map((result) => ({
                    id: result.id,
                    ruleCode: result.rule.code,
                    ruleDescription: result.rule.description,
                    status: result.status,
                    citedClause: result.citedClause,
                    rationale: result.rationale,
                    confidence: result.confidence,
                  })),
                }
              }
            }

            return (
              <ReviewCard
                key={item.id}
                item={itemData}
                reconciliation={reconciliation}
                compliance={compliance}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
