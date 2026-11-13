-- Records which settlement-link payment paid off a delivery partner's cash, so a repeated webhook
-- for the same payment is recognised and the part of a payment that settled nothing can be refunded.
ALTER TABLE "CashLiability" ADD COLUMN "settlementPaymentId" TEXT;

CREATE INDEX "CashLiability_settlementPaymentId_idx" ON "CashLiability"("settlementPaymentId");
