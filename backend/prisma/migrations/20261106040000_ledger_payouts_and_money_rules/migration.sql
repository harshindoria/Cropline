-- AlterTable
ALTER TABLE "LedgerEntry" ALTER COLUMN "orderId" DROP NOT NULL;


-- Prisma can't express these rules in the schema, so they live only in this migration.
ALTER TABLE "User" ADD CONSTRAINT "User_wallet_non_negative_check" CHECK ("walletBalance" >= 0);
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_amount_non_negative_check" CHECK ("amount" >= 0);
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_order_required_check" CHECK ("type" = 'PAYOUT' OR "orderId" IS NOT NULL);
