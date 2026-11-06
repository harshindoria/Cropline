-- An order can be re-assigned after a cancelled job, but never have two live jobs. This also keeps
-- acceptJob's race guard: two partners accepting at once still ends in a unique violation.
CREATE UNIQUE INDEX "DeliveryJob_one_active_per_order" ON "DeliveryJob"("orderId") WHERE "status" <> 'CANCELLED';

ALTER TABLE "DeliveryJob" ADD CONSTRAINT "DeliveryJob_cancelled_at_check"
  CHECK (("status" = 'CANCELLED') = ("cancelledAt" IS NOT NULL));
