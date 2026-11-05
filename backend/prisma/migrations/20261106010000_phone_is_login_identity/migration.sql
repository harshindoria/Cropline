-- One verified phone number = one account. Fails loudly, rather than guessing, if any
-- existing user has no phone, an unrecognised format, or a number that would collide.

-- Convert numbers saved by the old first-login form to the format Firebase tokens use.
UPDATE "User" SET "phone" = '+91' || "phone" WHERE "phone" ~ '^[6-9][0-9]{9}$';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "phone" SET NOT NULL;

-- Prisma can't express this rule in the schema, so it lives only in this migration.
ALTER TABLE "User" ADD CONSTRAINT "User_phone_format_check" CHECK ("phone" ~ '^\+91[6-9][0-9]{9}$');

-- Email is now unverified contact information, so nobody can block an address by typing it.
DROP INDEX "User_email_key";
