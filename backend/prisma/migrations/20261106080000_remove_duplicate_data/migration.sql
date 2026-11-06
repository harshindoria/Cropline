-- UserRoleAccess becomes the only record of a user's roles, so copy over anything only roles[] knows.
INSERT INTO "UserRoleAccess" ("id", "userId", "role", "status", "updatedAt")
SELECT gen_random_uuid()::text, u."id", r.role, 'ACTIVE', CURRENT_TIMESTAMP
FROM "User" u CROSS JOIN LATERAL unnest(u."roles") AS r(role)
ON CONFLICT ("userId", "role") DO UPDATE
SET "status" = 'ACTIVE', "updatedAt" = CURRENT_TIMESTAMP
WHERE "UserRoleAccess"."status" = 'PENDING_APPROVAL';

-- A rejected application used to be stored as BLOCKED, without the role ever being in roles[].
UPDATE "UserRoleAccess" a
SET "status" = 'REJECTED', "updatedAt" = CURRENT_TIMESTAMP
FROM "User" u
WHERE a."userId" = u."id" AND a."status" = 'BLOCKED' AND NOT (a."role" = ANY(u."roles"));

ALTER TABLE "User" DROP CONSTRAINT "User_activeRole_in_roles_check";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_cropId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_cropId_fkey";

-- AlterTable
ALTER TABLE "DeliveryJob" DROP COLUMN "acceptanceDeadline",
DROP COLUMN "notifiedPartners",
DROP COLUMN "offeredAt";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "isSubscription",
DROP COLUMN "paymentAuthorizedAt",
DROP COLUMN "paymentCapturedAt",
DROP COLUMN "paymentId",
DROP COLUMN "paymentStatus";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "roles";

-- AlterTable
ALTER TABLE "UserRoleAccess" DROP COLUMN "strikeCount";

-- CreateIndex
CREATE UNIQUE INDEX "Crop_id_farmerId_key" ON "Crop"("id", "farmerId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_cropId_farmerId_fkey" FOREIGN KEY ("cropId", "farmerId") REFERENCES "Crop"("id", "farmerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_cropId_farmerId_fkey" FOREIGN KEY ("cropId", "farmerId") REFERENCES "Crop"("id", "farmerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Replaces the old CHECK: the active role must be one the user holds. It runs at commit, so a new
-- user and their first role can be written in the same transaction.
CREATE FUNCTION "user_active_role_is_held"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_user TEXT;
BEGIN
  IF TG_TABLE_NAME = 'User' THEN
    target_user := NEW."id";
  ELSE
    target_user := OLD."userId";
  END IF;

  IF EXISTS (SELECT 1 FROM "User" WHERE "id" = target_user) AND NOT EXISTS (
    SELECT 1
    FROM "User" u
    JOIN "UserRoleAccess" a ON a."userId" = u."id" AND a."role" = u."activeRole"
    WHERE u."id" = target_user AND a."status" IN ('ACTIVE', 'BLOCKED')
  ) THEN
    RAISE EXCEPTION 'User_activeRole_not_held: user % has an active role they do not hold', target_user
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "User_activeRole_held"
AFTER INSERT OR UPDATE OF "activeRole" ON "User"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "user_active_role_is_held"();

CREATE CONSTRAINT TRIGGER "UserRoleAccess_keeps_activeRole_held"
AFTER UPDATE OF "status" OR DELETE ON "UserRoleAccess"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "user_active_role_is_held"();
