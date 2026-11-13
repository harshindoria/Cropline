-- A dispute (chargeback) is about the payment, not about where the order is in its delivery. It is
-- now recorded here instead of overwriting the order's status.
ALTER TABLE "PaymentRecord" ADD COLUMN "disputedAt" TIMESTAMPTZ(3);
