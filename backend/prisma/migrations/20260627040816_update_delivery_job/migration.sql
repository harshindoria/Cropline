/*
  Warnings:

  - You are about to drop the column `deliveryFee` on the `DeliveryJob` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "DeliveryJob" DROP COLUMN "deliveryFee",
ADD COLUMN     "acceptanceDeadline" TIMESTAMP(3),
ADD COLUMN     "notifiedPartners" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
