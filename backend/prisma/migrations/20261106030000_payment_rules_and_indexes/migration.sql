-- DropForeignKey
ALTER TABLE "PaymentRecord" DROP CONSTRAINT "PaymentRecord_orderId_fkey";

-- AlterTable
ALTER TABLE "PlatformSettings" ALTER COLUMN "cropMarkupRate" SET DATA TYPE DECIMAL(5,4),
ALTER COLUMN "deliveryMarkupRate" SET DATA TYPE DECIMAL(5,4);

-- CreateIndex
CREATE INDEX "Complaint_orderId_idx" ON "Complaint"("orderId");

-- CreateIndex
CREATE INDEX "Complaint_complainerId_idx" ON "Complaint"("complainerId");

-- CreateIndex
CREATE INDEX "Complaint_status_idx" ON "Complaint"("status");

-- CreateIndex
CREATE INDEX "Order_cropId_idx" ON "Order"("cropId");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_providerOrderId_key" ON "PaymentRecord"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_providerPaymentId_key" ON "PaymentRecord"("providerPaymentId");

-- CreateIndex
CREATE INDEX "Review_orderId_idx" ON "Review"("orderId");

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

