-- Encrypting needs the application's key, so SQL cannot do it. Stop rather than copy secrets as plain text.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "User"
    WHERE "bankAccount" IS NOT NULL OR "aadhaarUrl" IS NOT NULL OR "dlUrl" IS NOT NULL OR "rcUrl" IS NOT NULL
  ) OR EXISTS (SELECT 1 FROM "PayoutDetail") THEN
    RAISE EXCEPTION 'Existing bank details or documents must be encrypted by a script before this migration.';
  END IF;
END;
$$;

-- CreateEnum
CREATE TYPE "OtpKind" AS ENUM ('PICKUP', 'DELIVERY');

-- CreateTable
CREATE TABLE "FarmerProfile" (
    "userId" TEXT NOT NULL,
    "farmArea" DOUBLE PRECISION,
    "primaryCrops" TEXT,
    "farmingType" TEXT,
    "soilType" TEXT,
    "waterSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmerProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "DeliveryProfile" (
    "userId" TEXT NOT NULL,
    "vehicleType" "VehicleType",
    "vehicleNumber" TEXT,
    "vehicleColor" TEXT,
    "coverageRadiusKm" INTEGER,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "dailyEarningsGoal" DECIMAL(10,2) NOT NULL DEFAULT 2000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "BankDetails" (
    "userId" TEXT NOT NULL,
    "bankAccount" TEXT,
    "bankIfsc" TEXT,
    "bankName" TEXT,
    "accountHolderName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankDetails_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "KycDocuments" (
    "userId" TEXT NOT NULL,
    "aadhaarLast4" TEXT,
    "aadhaarUrl" TEXT,
    "aadhaarVerified" BOOLEAN NOT NULL DEFAULT false,
    "dlUrl" TEXT,
    "dlVerified" BOOLEAN NOT NULL DEFAULT false,
    "rcUrl" TEXT,
    "rcVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycDocuments_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "OrderOtp" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" "OtpKind" NOT NULL,
    "code" TEXT NOT NULL,
    "wrongAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryProfile_isOnline_idx" ON "DeliveryProfile"("isOnline");

-- CreateIndex
CREATE UNIQUE INDEX "OrderOtp_orderId_kind_key" ON "OrderOtp"("orderId", "kind");

-- AddForeignKey
ALTER TABLE "FarmerProfile" ADD CONSTRAINT "FarmerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryProfile" ADD CONSTRAINT "DeliveryProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankDetails" ADD CONSTRAINT "BankDetails_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycDocuments" ADD CONSTRAINT "KycDocuments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderOtp" ADD CONSTRAINT "OrderOtp_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Move the remaining data to its new tables.
INSERT INTO "FarmerProfile" ("userId", "farmArea", "primaryCrops", "farmingType", "soilType", "waterSource", "updatedAt")
SELECT "id", "farmArea", "primaryCrops", "farmingType", "soilType", "waterSource", CURRENT_TIMESTAMP FROM "User"
WHERE "farmArea" IS NOT NULL OR "primaryCrops" IS NOT NULL OR "farmingType" IS NOT NULL
  OR "soilType" IS NOT NULL OR "waterSource" IS NOT NULL;

INSERT INTO "DeliveryProfile" ("userId", "vehicleType", "vehicleNumber", "vehicleColor", "coverageRadiusKm", "isOnline", "dailyEarningsGoal", "updatedAt")
SELECT "id", "vehicleType", "vehicleNumber", "vehicleColor", "coverageRadiusKm", "isOnline", "dailyEarningsGoal", CURRENT_TIMESTAMP FROM "User"
WHERE "vehicleType" IS NOT NULL OR "vehicleNumber" IS NOT NULL OR "vehicleColor" IS NOT NULL
  OR "coverageRadiusKm" IS NOT NULL OR "isOnline" OR "dailyEarningsGoal" <> 2000;

INSERT INTO "BankDetails" ("userId", "bankIfsc", "bankName", "accountHolderName", "updatedAt")
SELECT "id", "bankIfsc", "bankName", "accountHolderName", CURRENT_TIMESTAMP FROM "User"
WHERE "bankIfsc" IS NOT NULL OR "bankName" IS NOT NULL OR "accountHolderName" IS NOT NULL;

INSERT INTO "KycDocuments" ("userId", "aadhaarLast4", "aadhaarVerified", "dlVerified", "rcVerified", "updatedAt")
SELECT "id", "aadhaarLast4", "aadhaarVerified", "dlVerified", "rcVerified", CURRENT_TIMESTAMP FROM "User"
WHERE "aadhaarLast4" IS NOT NULL OR "aadhaarVerified" OR "dlVerified" OR "rcVerified";

INSERT INTO "OrderOtp" ("id", "orderId", "kind", "code", "updatedAt")
SELECT gen_random_uuid()::text, "id", 'PICKUP', "pickupOtp", CURRENT_TIMESTAMP FROM "Order" WHERE "pickupOtp" IS NOT NULL;

INSERT INTO "OrderOtp" ("id", "orderId", "kind", "code", "updatedAt")
SELECT gen_random_uuid()::text, "id", 'DELIVERY', "deliveryOtp", CURRENT_TIMESTAMP FROM "Order" WHERE "deliveryOtp" IS NOT NULL;

-- DropIndex
DROP INDEX "User_activeRole_isOnline_idx";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "deliveryOtp",
DROP COLUMN "pickupOtp";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "aadhaarLast4",
DROP COLUMN "aadhaarUrl",
DROP COLUMN "aadhaarVerified",
DROP COLUMN "accountHolderName",
DROP COLUMN "bankAccount",
DROP COLUMN "bankIfsc",
DROP COLUMN "bankName",
DROP COLUMN "coverageRadiusKm",
DROP COLUMN "dailyEarningsGoal",
DROP COLUMN "dlUrl",
DROP COLUMN "dlVerified",
DROP COLUMN "farmArea",
DROP COLUMN "farmingType",
DROP COLUMN "fcmToken",
DROP COLUMN "isOnline",
DROP COLUMN "lastOnlineResetAt",
DROP COLUMN "onlineStartedAt",
DROP COLUMN "primaryCrops",
DROP COLUMN "rcUrl",
DROP COLUMN "rcVerified",
DROP COLUMN "soilType",
DROP COLUMN "todayOnlineMinutes",
DROP COLUMN "vehicleColor",
DROP COLUMN "vehicleNumber",
DROP COLUMN "vehicleType",
DROP COLUMN "waterSource";

