import { Badge } from "@/components/ui/badge"
import { prisma } from "@/lib/db"
import { PageHeader } from "@/components/dashboard/page-header"
import {
  DeleteRuleButton,
  EditRuleDialog,
  CreateRuleDialog,
} from "@/components/dashboard/policies/rule-dialogs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { ScaleIcon } from "lucide-react"

export const dynamic = "force-dynamic"

const severityVariant = {
  critical: "destructive",
  major: "default",
  minor: "secondary",
} as const

export default async function PoliciesPage() {
  const rules = await prisma.rule.findMany({ orderBy: { code: "asc" } })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Policies"
        description="The procurement rulebook. The compliance agent judges every uploaded PO against these rules; the baseline checker uses the keywords."
        actions={<CreateRuleDialog />}
      />
      {rules.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <ScaleIcon />
            </EmptyMedia>
            <EmptyTitle>No policy rules yet</EmptyTitle>
            <EmptyDescription>
              Create your first rule, then upload POs to have the agent check
              them.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Baseline keywords</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-mono text-xs font-medium">
                    {rule.code}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {rule.category}
                  </TableCell>
                  <TableCell className="max-w-sm">{rule.description}</TableCell>
                  <TableCell>
                    <div className="flex max-w-56 flex-wrap gap-1">
                      {rule.keywords.slice(0, 3).map((k) => (
                        <Badge key={k} variant="outline" className="font-mono text-[11px]">
                          {k}
                        </Badge>
                      ))}
                      {rule.keywords.length > 3 ? (
                        <span className="text-xs text-muted-foreground">
                          +{rule.keywords.length - 3}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={severityVariant[rule.severity as keyof typeof severityVariant] ?? "secondary"}>
                      {rule.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <EditRuleDialog rule={rule} />
                      <DeleteRuleButton id={rule.id} code={rule.code} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {rules.length} rule{rules.length === 1 ? "" : "s"} · rulebook changes
        apply to the next agent run
      </p>
    </div>
  )
}
