-- PENDING meant two different things: a cash order's money still with the delivery partner, and a
-- payout still waiting for admin's bank transfer. Each now has its own status.

DROP INDEX "LedgerEntry_one_pending_payout";
ALTER TABLE "LedgerEntry" ALTER COLUMN "status" DROP DEFAULT;

-- AlterEnum
BEGIN;
CREATE TYPE "LedgerEntryStatus_new" AS ENUM ('AWAITING_CASH', 'AWAITING_TRANSFER', 'AVAILABLE', 'SETTLED', 'FAILED');
ALTER TABLE "LedgerEntry" ALTER COLUMN "status" TYPE "LedgerEntryStatus_new" USING (
  CASE
    WHEN "status"::text <> 'PENDING' THEN "status"::text
    WHEN "type" = 'PAYOUT' THEN 'AWAITING_TRANSFER'
    ELSE 'AWAITING_CASH'
  END::"LedgerEntryStatus_new"
);
ALTER TYPE "LedgerEntryStatus" RENAME TO "LedgerEntryStatus_old";
ALTER TYPE "LedgerEntryStatus_new" RENAME TO "LedgerEntryStatus";
DROP TYPE "public"."LedgerEntryStatus_old";
COMMIT;

CREATE UNIQUE INDEX "LedgerEntry_one_pending_payout" ON "LedgerEntry"("userId") WHERE "type" = 'PAYOUT' AND "status" = 'AWAITING_TRANSFER';

-- Each type can only be in the statuses that make sense for it.
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_status_matches_type_check" CHECK (
  CASE "type"
    WHEN 'PAYOUT' THEN "status" IN ('AWAITING_TRANSFER', 'SETTLED', 'FAILED')
    WHEN 'FARMER_EARNING' THEN "status" IN ('AWAITING_CASH', 'AVAILABLE')
    WHEN 'DELIVERY_EARNING' THEN "status" IN ('AWAITING_CASH', 'AVAILABLE')
    ELSE "status" IN ('AWAITING_CASH', 'SETTLED')
  END
);

CREATE OR REPLACE FUNCTION "ledger_entry_is_protected"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'LedgerEntry_protected: ledger entries cannot be deleted'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF NEW."amount" IS DISTINCT FROM OLD."amount"
    OR NEW."type" IS DISTINCT FROM OLD."type"
    OR NEW."userId" IS DISTINCT FROM OLD."userId"
    OR NEW."orderId" IS DISTINCT FROM OLD."orderId"
    OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'LedgerEntry_protected: the facts of a ledger entry cannot change'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF NEW."status" <> OLD."status" AND NOT (
    (OLD."status" = 'AWAITING_CASH' AND NEW."status" IN ('AVAILABLE', 'SETTLED'))
    OR (OLD."status" = 'AWAITING_TRANSFER' AND NEW."status" IN ('SETTLED', 'FAILED'))
  ) THEN
    RAISE EXCEPTION 'LedgerEntry_protected: status cannot move from % to %', OLD."status", NEW."status"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$;
