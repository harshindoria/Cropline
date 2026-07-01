-- Multi-role workspace migration. This migration is intentionally revised in-place
-- because it has not been deployed.
CREATE TYPE "RoleAccessStatus" AS ENUM ('ACTIVE', 'BLOCKED');
CREATE TYPE "DeliveryOfferStatus" AS ENUM ('OFFERED', 'DECLINED', 'EXPIRED', 'ACCEPTED', 'LOST');
CREATE TYPE "VerificationPurpose" AS ENUM ('FARMER_HANDOVER', 'BUYER_DELIVERY');
CREATE TYPE "LedgerEntryType" AS ENUM ('FARMER_EARNING', 'DELIVERY_EARNING', 'PLATFORM_CROP_FEE', 'PLATFORM_DELIVERY_FEE', 'CASH_LIABILITY', 'REFUND', 'PAYOUT');
CREATE TYPE "LedgerEntryStatus" AS ENUM ('PENDING', 'AVAILABLE', 'SETTLED', 'VOIDED');
ALTER TYPE "OrderStatus" ADD VALUE 'DELIVERY_SEARCHING';
ALTER TYPE "OrderStatus" ADD VALUE 'DELIVERY_UNAVAILABLE';

ALTER TABLE "User"
ADD COLUMN "roles" "Role"[] NOT NULL DEFAULT ARRAY['BUYER']::"Role"[],
ADD COLUMN "activeRole" "Role" NOT NULL DEFAULT 'BUYER';

UPDATE "User" SET "roles" = ARRAY["role"]::"Role"[], "activeRole" = "role";
DROP INDEX IF EXISTS "User_role_isOnline_idx";
DROP INDEX IF EXISTS "User_planType_planExpiresAt_idx";
ALTER TABLE "User" DROP COLUMN "role", DROP COLUMN "planType", DROP COLUMN "planExpiresAt";
DROP TABLE IF EXISTS "MembershipPayment";
DROP TYPE IF EXISTS "PlanType";
CREATE INDEX "User_activeRole_isOnline_idx" ON "User"("activeRole", "isOnline");
ALTER TABLE "User" ADD CONSTRAINT "User_activeRole_in_roles_check" CHECK ("activeRole" = ANY("roles"));

ALTER TABLE "Crop" RENAME COLUMN "pricePerKg" TO "basePricePerKg";
ALTER TABLE "Order" RENAME COLUMN "pricePerKg" TO "basePricePerKg";
ALTER TABLE "Order" RENAME COLUMN "totalAmount" TO "totalBuyerPrice";
ALTER TABLE "Order"
ADD COLUMN "cropMarkupRate" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
ADD COLUMN "deliveryCommissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.20,
ADD COLUMN "deliveryPlatformFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "deliveryPartnerPayout" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "farmerResponseDeadline" TIMESTAMP(3),
ADD COLUMN "farmerAcceptedAt" TIMESTAMP(3),
ADD COLUMN "paymentAuthorizedAt" TIMESTAMP(3),
ADD COLUMN "paymentCapturedAt" TIMESTAMP(3),
ADD COLUMN "dispatchStartedAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3);
UPDATE "Order" SET
  "deliveryPlatformFee" = ROUND("deliveryFee" * 0.20, 2),
  "deliveryPartnerPayout" = "deliveryFee" - ROUND("deliveryFee" * 0.20, 2),
  "farmerResponseDeadline" = "createdAt" + INTERVAL '24 hours';
ALTER TABLE "Order"
ADD CONSTRAINT "Order_money_non_negative_check" CHECK (
  "farmerEarnings" >= 0 AND "platformFee" >= 0 AND "deliveryFee" >= 0
  AND "deliveryPlatformFee" >= 0 AND "deliveryPartnerPayout" >= 0
  AND "discountAmount" >= 0 AND "totalBuyerPrice" >= 0
),
ADD CONSTRAINT "Order_total_buyer_price_check" CHECK (
  "totalBuyerPrice" = "farmerEarnings" + "platformFee" + "deliveryFee" - "discountAmount"
),
ADD CONSTRAINT "Order_delivery_split_check" CHECK (
  "deliveryFee" = "deliveryPlatformFee" + "deliveryPartnerPayout"
);

CREATE TABLE "UserRoleAccess" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "role" "Role" NOT NULL,
  "status" "RoleAccessStatus" NOT NULL DEFAULT 'ACTIVE', "reason" TEXT,
  "blockedAt" TIMESTAMP(3), "blockedUntil" TIMESTAMP(3), "blockedByAdminId" TEXT,
  "strikeCount" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "UserRoleAccess_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserRoleAccess_userId_role_key" ON "UserRoleAccess"("userId", "role");
CREATE INDEX "UserRoleAccess_role_status_blockedUntil_idx" ON "UserRoleAccess"("role", "status", "blockedUntil");
ALTER TABLE "UserRoleAccess" ADD CONSTRAINT "UserRoleAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRoleAccess" ADD CONSTRAINT "UserRoleAccess_blockedByAdminId_fkey" FOREIGN KEY ("blockedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
INSERT INTO "UserRoleAccess" ("id", "userId", "role", "updatedAt")
SELECT 'ra_' || md5("id" || r::text), "id", r, CURRENT_TIMESTAMP FROM "User", unnest("roles") r;

CREATE TABLE "DeliveryOffer" (
  "id" TEXT NOT NULL, "orderId" TEXT NOT NULL, "partnerId" TEXT NOT NULL,
  "wave" INTEGER NOT NULL, "radiusKm" INTEGER NOT NULL,
  "status" "DeliveryOfferStatus" NOT NULL DEFAULT 'OFFERED',
  "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL,
  "respondedAt" TIMESTAMP(3), CONSTRAINT "DeliveryOffer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DeliveryOffer_orderId_partnerId_key" ON "DeliveryOffer"("orderId", "partnerId");
CREATE INDEX "DeliveryOffer_partnerId_status_expiresAt_idx" ON "DeliveryOffer"("partnerId", "status", "expiresAt");
CREATE INDEX "DeliveryOffer_orderId_wave_idx" ON "DeliveryOffer"("orderId", "wave");
ALTER TABLE "DeliveryOffer" ADD CONSTRAINT "DeliveryOffer_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryOffer" ADD CONSTRAINT "DeliveryOffer_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "VerificationToken" (
  "id" TEXT NOT NULL, "orderId" TEXT NOT NULL, "purpose" "VerificationPurpose" NOT NULL,
  "jti" TEXT NOT NULL, "issuedToUserId" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VerificationToken_jti_key" ON "VerificationToken"("jti");
CREATE INDEX "VerificationToken_orderId_purpose_consumedAt_idx" ON "VerificationToken"("orderId", "purpose", "consumedAt");
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PaymentRecord" (
  "id" TEXT NOT NULL, "orderId" TEXT NOT NULL, "provider" TEXT NOT NULL,
  "providerOrderId" TEXT, "providerPaymentId" TEXT, "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "amount" DECIMAL(10,2) NOT NULL, "authorizedAt" TIMESTAMP(3), "capturedAt" TIMESTAMP(3),
  "refundedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentRecord_orderId_key" ON "PaymentRecord"("orderId");
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LedgerEntry" (
  "id" TEXT NOT NULL, "orderId" TEXT NOT NULL, "userId" TEXT, "type" "LedgerEntryType" NOT NULL,
  "status" "LedgerEntryStatus" NOT NULL DEFAULT 'PENDING', "amount" DECIMAL(10,2) NOT NULL,
  "idempotencyKey" TEXT NOT NULL, "availableAt" TIMESTAMP(3), "settledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LedgerEntry_idempotencyKey_key" ON "LedgerEntry"("idempotencyKey");
CREATE INDEX "LedgerEntry_userId_status_idx" ON "LedgerEntry"("userId", "status");
CREATE INDEX "LedgerEntry_orderId_type_idx" ON "LedgerEntry"("orderId", "type");
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CashLiability" (
  "id" TEXT NOT NULL, "orderId" TEXT NOT NULL, "deliveryPartnerId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL, "reconciledAt" TIMESTAMP(3), "reconciledByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CashLiability_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CashLiability_orderId_key" ON "CashLiability"("orderId");
CREATE INDEX "CashLiability_deliveryPartnerId_reconciledAt_idx" ON "CashLiability"("deliveryPartnerId", "reconciledAt");
ALTER TABLE "CashLiability" ADD CONSTRAINT "CashLiability_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashLiability" ADD CONSTRAINT "CashLiability_deliveryPartnerId_fkey" FOREIGN KEY ("deliveryPartnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
