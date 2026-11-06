-- DropForeignKey
ALTER TABLE "LedgerEntry" DROP CONSTRAINT "LedgerEntry_userId_fkey";

-- CreateTable
CREATE TABLE "PayoutDetail" (
    "id" TEXT NOT NULL,
    "ledgerEntryId" TEXT NOT NULL,
    "bankAccount" TEXT NOT NULL,
    "bankIfsc" TEXT NOT NULL,
    "bankName" TEXT,
    "accountHolderName" TEXT,
    "processedByAdminId" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayoutDetail_ledgerEntryId_key" ON "PayoutDetail"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "PayoutDetail_processedByAdminId_idx" ON "PayoutDetail"("processedByAdminId");

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutDetail" ADD CONSTRAINT "PayoutDetail_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutDetail" ADD CONSTRAINT "PayoutDetail_processedByAdminId_fkey" FOREIGN KEY ("processedByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Platform fees belong to nobody. Everything else must name its owner.
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_owner_matches_type_check" CHECK (
  ("type" IN ('PLATFORM_CROP_FEE', 'PLATFORM_DELIVERY_FEE')) = ("userId" IS NULL)
);

-- The facts of an entry are permanent. Its status can only move forward.
CREATE FUNCTION "ledger_entry_is_protected"() RETURNS trigger LANGUAGE plpgsql AS $$
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
    (OLD."status" = 'PENDING' AND NEW."status" IN ('AVAILABLE', 'SETTLED', 'FAILED', 'VOIDED'))
    OR (OLD."status" = 'AVAILABLE' AND NEW."status" IN ('SETTLED', 'VOIDED'))
  ) THEN
    RAISE EXCEPTION 'LedgerEntry_protected: status cannot move from % to %', OLD."status", NEW."status"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "LedgerEntry_protected"
BEFORE UPDATE OR DELETE ON "LedgerEntry"
FOR EACH ROW EXECUTE FUNCTION "ledger_entry_is_protected"();
