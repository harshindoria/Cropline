-- CreateIndex
CREATE UNIQUE INDEX "Complaint_orderId_complainerId_accusedId_key" ON "Complaint"("orderId", "complainerId", "accusedId");

