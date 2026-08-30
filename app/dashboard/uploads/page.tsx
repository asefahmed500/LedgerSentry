import Link from "next/link"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/dashboard/page-header"
import { UploadInvoiceForm, type PoOption } from "@/components/dashboard/uploads/upload-invoice-form"
import { UploadPolicyForm } from "@/components/dashboard/uploads/upload-policy-form"
import { Button } from "@/components/ui/button"
import { ArrowRightIcon, Link2Icon } from "lucide-react"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function UploadsPage() {
  const poDocs = await prisma.policyDocument.findMany({
    select: { id: true, title: true, vendor: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  const poOptions: PoOption[] = poDocs

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Upload documents"
        description="Add your own invoices and purchase orders in three steps, then run the baseline or the agent on them."
      />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoice (scanned image)</CardTitle>
            <CardDescription>
              Scan → review the OCR fields → optionally link the PO it bills
              against → upload.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UploadInvoiceForm poOptions={poOptions} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">PO / contract (PDF)</CardTitle>
            <CardDescription>
              Document → details → confirm. Digital or scanned PDFs both work.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UploadPolicyForm />
          </CardContent>
        </Card>
      </div>
      <Separator />
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Link2Icon className="size-3.5 text-primary" />
          Linking an invoice to its PO surfaces that PO&rsquo;s compliance
          status on the invoice.
        </span>
        <span className="hidden sm:inline">·</span>
        Next steps:
        <Button variant="outline" size="sm" render={<Link href="/dashboard/reconciliation" />}>
          Reconciliation
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
        <Button variant="outline" size="sm" render={<Link href="/dashboard/compliance" />}>
          Compliance
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
        <Button variant="outline" size="sm" render={<Link href="/dashboard/policies" />}>
          Policies
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
        <Button variant="outline" size="sm" render={<Link href="/dashboard/reports" />}>
          Reports
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </div>
    </div>
  )
}
