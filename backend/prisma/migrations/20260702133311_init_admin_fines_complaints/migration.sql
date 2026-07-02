/*
  Warnings:

  - You are about to drop the column `category` on the `Crop` table. All the data in the column will be lost.
  - You are about to drop the column `cropName` on the `Crop` table. All the data in the column will be lost.
  - Added the required column `catalogId` to the `Crop` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UnbanFeeStatus" AS ENUM ('NONE', 'PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "NotificationAlertLevel" AS ENUM ('INFO', 'WARNING', 'CRITICAL', 'SUCCESS');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');

-- AlterEnum
ALTER TYPE "RoleAccessStatus" ADD VALUE 'PENDING_APPROVAL';

-- DropIndex
DROP INDEX "Crop_status_category_idx";

-- AlterTable
ALTER TABLE "Crop" DROP COLUMN "category",
DROP COLUMN "cropName",
ADD COLUMN     "catalogId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "alertLevel" "NotificationAlertLevel" NOT NULL DEFAULT 'INFO';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "pickupOtp" TEXT,
ALTER COLUMN "cropMarkupRate" DROP DEFAULT,
ALTER COLUMN "deliveryCommissionRate" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "farmArea" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "UserRoleAccess" ADD COLUMN     "unbanFeeAmount" DECIMAL(10,2),
ADD COLUMN     "unbanFeeStatus" "UnbanFeeStatus" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "CropCatalog" (
    "id" TEXT NOT NULL,
    "englishName" TEXT NOT NULL,
    "hindiName" TEXT NOT NULL,
    "category" "CropCategory" NOT NULL,
    "imageTemplate" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CropCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CropOffer" (
    "id" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "minQuantityKg" DECIMAL(10,2) NOT NULL,
    "discountPercentage" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CropOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "complainerId" TEXT NOT NULL,
    "accusedId" TEXT NOT NULL,
    "accusedRole" "Role" NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CropCatalog_category_isActive_idx" ON "CropCatalog"("category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CropOffer_cropId_key" ON "CropOffer"("cropId");

-- CreateIndex
CREATE INDEX "Complaint_accusedId_accusedRole_idx" ON "Complaint"("accusedId", "accusedRole");

-- CreateIndex
CREATE INDEX "Crop_status_catalogId_idx" ON "Crop"("status", "catalogId");

-- AddForeignKey
ALTER TABLE "Crop" ADD CONSTRAINT "Crop_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "CropCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropOffer" ADD CONSTRAINT "CropOffer_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_complainerId_fkey" FOREIGN KEY ("complainerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_accusedId_fkey" FOREIGN KEY ("accusedId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
