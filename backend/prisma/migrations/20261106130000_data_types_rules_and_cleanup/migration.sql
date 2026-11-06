-- Existing timestamps were written as UTC, so read them as UTC while converting them.
SET TIME ZONE 'UTC';

-- Postgres won't change a column's type while a trigger or CHECK depends on it. These return below.
DROP TRIGGER "Order_record_status" ON "Order";
ALTER TABLE "LedgerEntry" DROP CONSTRAINT "LedgerEntry_order_required_check";
ALTER TABLE "LedgerEntry" DROP CONSTRAINT "LedgerEntry_owner_matches_type_check";

-- AlterEnum
BEGIN;
CREATE TYPE "CropStatus_new" AS ENUM ('ACTIVE', 'PAUSED', 'CLOSED');
ALTER TABLE "public"."Crop" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Crop" ALTER COLUMN "status" TYPE "CropStatus_new" USING ("status"::text::"CropStatus_new");
ALTER TYPE "CropStatus" RENAME TO "CropStatus_old";
ALTER TYPE "CropStatus_new" RENAME TO "CropStatus";
DROP TYPE "public"."CropStatus_old";
ALTER TABLE "Crop" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "LedgerEntryStatus_new" AS ENUM ('PENDING', 'AVAILABLE', 'SETTLED', 'FAILED');
ALTER TABLE "public"."LedgerEntry" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "LedgerEntry" ALTER COLUMN "status" TYPE "LedgerEntryStatus_new" USING ("status"::text::"LedgerEntryStatus_new");
ALTER TYPE "LedgerEntryStatus" RENAME TO "LedgerEntryStatus_old";
ALTER TYPE "LedgerEntryStatus_new" RENAME TO "LedgerEntryStatus";
DROP TYPE "public"."LedgerEntryStatus_old";
ALTER TABLE "LedgerEntry" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "LedgerEntryType_new" AS ENUM ('FARMER_EARNING', 'DELIVERY_EARNING', 'PLATFORM_CROP_FEE', 'PLATFORM_DELIVERY_FEE', 'PAYOUT');
ALTER TABLE "LedgerEntry" ALTER COLUMN "type" TYPE "LedgerEntryType_new" USING ("type"::text::"LedgerEntryType_new");
ALTER TYPE "LedgerEntryType" RENAME TO "LedgerEntryType_old";
ALTER TYPE "LedgerEntryType_new" RENAME TO "LedgerEntryType";
DROP TYPE "public"."LedgerEntryType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('PENDING', 'CONFIRMED', 'READY_FOR_PICKUP', 'DELIVERY_SEARCHING', 'ASSIGNED', 'PICKED_UP', 'IN_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'DISPUTED');
ALTER TABLE "public"."Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TABLE "OrderStatusHistory" ALTER COLUMN "fromStatus" TYPE "OrderStatus_new" USING ("fromStatus"::text::"OrderStatus_new");
ALTER TABLE "OrderStatusHistory" ALTER COLUMN "toStatus" TYPE "OrderStatus_new" USING ("toStatus"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- A rename keeps any existing cash orders.
ALTER TYPE "PaymentType" RENAME VALUE 'CASH_ON_PICKUP' TO 'CASH';

-- DropIndex
DROP INDEX "DeliveryJob_pickupLatitude_pickupLongitude_idx";

-- DropIndex
DROP INDEX "User_latitude_longitude_idx";

-- AlterTable
ALTER TABLE "BankDetails" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "CashLiability" ALTER COLUMN "reconciledAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "depositedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Complaint" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "resolvedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Crop" ALTER COLUMN "harvestDate" SET DATA TYPE DATE,
ALTER COLUMN "preHarvestDeadline" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "CropCatalog" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "CropOffer" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "DeliveryJob" ALTER COLUMN "liveLocationUpdatedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "acceptedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "pickedUpAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "deliveredAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "estimatedDeliveryAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "cancelledAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "DeliveryOffer" ALTER COLUMN "offeredAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "respondedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "DeliveryProfile" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "FarmerProfile" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "KycDocuments" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "LedgerEntry" ALTER COLUMN "availableAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "settledAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "deliveryDate" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "farmerResponseDeadline" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "farmerAcceptedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "dispatchStartedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "completedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "OrderOtp" ALTER COLUMN "lockedUntil" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "OrderStatusHistory" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "PaymentAttempt" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "PaymentRecord" ALTER COLUMN "authorizedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "capturedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "refundedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "PayoutDetail" ALTER COLUMN "processedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "PlatformSettings" ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Refund" ALTER COLUMN "processedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Review" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "RoleAccessEvent" ALTER COLUMN "blockedUntil" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "dob" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "UserRoleAccess" ALTER COLUMN "blockedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "blockedUntil" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "Crop_catalogId_idx" ON "Crop"("catalogId");

-- CreateIndex
CREATE UNIQUE INDEX "CropCatalog_englishName_key" ON "CropCatalog"("englishName");

-- CreateIndex
CREATE INDEX "LedgerEntry_type_status_idx" ON "LedgerEntry"("type", "status");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

RESET TIME ZONE;

CREATE TRIGGER "Order_record_status"
AFTER INSERT OR UPDATE OF "status" ON "Order"
FOR EACH ROW EXECUTE FUNCTION "record_order_status"();

ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_order_required_check" CHECK ("type" = 'PAYOUT' OR "orderId" IS NOT NULL);
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_owner_matches_type_check" CHECK (
  ("type" IN ('PLATFORM_CROP_FEE', 'PLATFORM_DELIVERY_FEE')) = ("userId" IS NULL)
);

-- The VOIDED status no longer exists.
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
    (OLD."status" = 'PENDING' AND NEW."status" IN ('AVAILABLE', 'SETTLED', 'FAILED'))
    OR (OLD."status" = 'AVAILABLE' AND NEW."status" = 'SETTLED')
  ) THEN
    RAISE EXCEPTION 'LedgerEntry_protected: status cannot move from % to %', OLD."status", NEW."status"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Rules Prisma cannot describe in the schema file.
ALTER TABLE "Crop"
ADD CONSTRAINT "Crop_stock_check" CHECK ("quantityKg" > 0 AND "quantityRemainingKg" >= 0 AND "quantityRemainingKg" <= "quantityKg"),
ADD CONSTRAINT "Crop_price_check" CHECK ("basePricePerKg" > 0),
ADD CONSTRAINT "Crop_minimum_order_check" CHECK ("minOrderKg" > 0);

ALTER TABLE "CropOffer" ADD CONSTRAINT "CropOffer_values_check" CHECK (
  "minQuantityKg" > 0 AND "discountPercentage" > 0 AND "discountPercentage" <= 100
);

ALTER TABLE "Order"
ADD CONSTRAINT "Order_quantity_check" CHECK ("quantityKg" > 0),
ADD CONSTRAINT "Order_buyer_not_farmer_check" CHECK ("buyerId" <> "farmerId"),
ADD CONSTRAINT "Order_delivery_location_check" CHECK (
  "deliveryType" <> 'DELIVERY' OR ("deliveryLatitude" IS NOT NULL AND "deliveryLongitude" IS NOT NULL)
);

ALTER TABLE "Review"
ADD CONSTRAINT "Review_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
ADD CONSTRAINT "Review_not_self_check" CHECK ("reviewerId" <> "targetId");

ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_not_self_check" CHECK ("complainerId" <> "accusedId");
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_amount_check" CHECK ("amount" >= 0);
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_amount_check" CHECK ("amount" >= 0);
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_amount_check" CHECK ("amount" > 0);
ALTER TABLE "CashLiability" ADD CONSTRAINT "CashLiability_amount_check" CHECK ("amount" >= 0);

CREATE UNIQUE INDEX "LedgerEntry_one_pending_payout" ON "LedgerEntry"("userId") WHERE "type" = 'PAYOUT' AND "status" = 'PENDING';
CREATE UNIQUE INDEX "PlatformSettings_single_row" ON "PlatformSettings"((true));
