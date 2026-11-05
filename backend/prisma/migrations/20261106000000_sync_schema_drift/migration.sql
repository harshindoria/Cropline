-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('GENERAL', 'ANNOUNCEMENT', 'WARNING', 'MAINTENANCE', 'OFFER');

-- CreateEnum
CREATE TYPE "CashDepositStatus" AS ENUM ('PENDING_DEPOSIT', 'DEPOSITED', 'VERIFIED', 'OVERDUE');

-- AlterEnum
BEGIN;
CREATE TYPE "ComplaintStatus_new" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'DISMISSED');
ALTER TABLE "public"."Complaint" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Complaint" ALTER COLUMN "status" TYPE "ComplaintStatus_new" USING ("status"::text::"ComplaintStatus_new");
ALTER TYPE "ComplaintStatus" RENAME TO "ComplaintStatus_old";
ALTER TYPE "ComplaintStatus_new" RENAME TO "ComplaintStatus";
DROP TYPE "public"."ComplaintStatus_old";
ALTER TABLE "Complaint" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CropCategory" ADD VALUE 'PULSES';
ALTER TYPE "CropCategory" ADD VALUE 'OILSEEDS';

-- AlterEnum
ALTER TYPE "LedgerEntryStatus" ADD VALUE 'FAILED';

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentStatus_new" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');
ALTER TABLE "public"."Order" ALTER COLUMN "paymentStatus" DROP DEFAULT;
ALTER TABLE "public"."PaymentRecord" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "paymentStatus" TYPE "PaymentStatus_new" USING ("paymentStatus"::text::"PaymentStatus_new");
ALTER TABLE "PaymentRecord" ALTER COLUMN "status" TYPE "PaymentStatus_new" USING ("status"::text::"PaymentStatus_new");
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "public"."PaymentStatus_old";
ALTER TABLE "Order" ALTER COLUMN "paymentStatus" SET DEFAULT 'PENDING';
ALTER TABLE "PaymentRecord" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_orderId_fkey";

-- DropForeignKey
ALTER TABLE "VerificationToken" DROP CONSTRAINT "VerificationToken_orderId_fkey";

-- DropIndex
DROP INDEX "CashLiability_deliveryPartnerId_reconciledAt_idx";

-- DropIndex
DROP INDEX "Review_orderId_reviewerId_targetId_key";

-- AlterTable
ALTER TABLE "CashLiability" ADD COLUMN     "depositedAt" TIMESTAMP(3),
ADD COLUMN     "status" "CashDepositStatus" NOT NULL DEFAULT 'PENDING_DEPOSIT';

-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "adminRemark" TEXT,
ADD COLUMN     "evidence" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "type",
ADD COLUMN     "type" "NotificationType" NOT NULL DEFAULT 'GENERAL';

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "qrCode",
ADD COLUMN     "deliveryOtp" TEXT;

-- AlterTable
ALTER TABLE "Review" ALTER COLUMN "orderId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aadhaarUrl" TEXT,
ADD COLUMN     "aadhaarVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aboutMe" TEXT,
ADD COLUMN     "accountHolderName" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "dailyEarningsGoal" DECIMAL(10,2) NOT NULL DEFAULT 2000,
ADD COLUMN     "dlUrl" TEXT,
ADD COLUMN     "dlVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "farmingType" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "languagePref" TEXT,
ADD COLUMN     "lastOnlineResetAt" TIMESTAMP(3),
ADD COLUMN     "onlineStartedAt" TIMESTAMP(3),
ADD COLUMN     "primaryCrops" TEXT,
ADD COLUMN     "rcUrl" TEXT,
ADD COLUMN     "rcVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "soilType" TEXT,
ADD COLUMN     "todayOnlineMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vehicleColor" TEXT,
ADD COLUMN     "vehicleNumber" TEXT,
ADD COLUMN     "waterSource" TEXT;

-- DropTable
DROP TABLE "VerificationToken";

-- DropEnum
DROP TYPE "VerificationPurpose";

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL,
    "cropMarkupRate" DECIMAL(10,2) NOT NULL DEFAULT 0.20,
    "deliveryMarkupRate" DECIMAL(10,2) NOT NULL DEFAULT 0.20,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashLiability_deliveryPartnerId_status_idx" ON "CashLiability"("deliveryPartnerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Review_reviewerId_targetId_key" ON "Review"("reviewerId", "targetId");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

