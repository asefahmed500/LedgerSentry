-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "poId" TEXT;

-- CreateIndex
CREATE INDEX "Invoice_poId_idx" ON "Invoice"("poId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PolicyDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
