/*
  Warnings:

  - You are about to drop the `PlatformMembership` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PlatformMembership" DROP CONSTRAINT "PlatformMembership_farmerId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "fcmToken" TEXT,
ADD COLUMN     "planExpiresAt" TIMESTAMP(3),
ADD COLUMN     "planType" "PlanType" NOT NULL DEFAULT 'FREE';

-- DropTable
DROP TABLE "PlatformMembership";

-- CreateTable
CREATE TABLE "MembershipPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planType" "PlanType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "razorpayPaymentId" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MembershipPayment_userId_idx" ON "MembershipPayment"("userId");

-- CreateIndex
CREATE INDEX "MembershipPayment_paymentStatus_idx" ON "MembershipPayment"("paymentStatus");

-- CreateIndex
CREATE INDEX "User_latitude_longitude_idx" ON "User"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "User_role_isOnline_idx" ON "User"("role", "isOnline");

-- CreateIndex
CREATE INDEX "User_planType_planExpiresAt_idx" ON "User"("planType", "planExpiresAt");

-- AddForeignKey
ALTER TABLE "MembershipPayment" ADD CONSTRAINT "MembershipPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
