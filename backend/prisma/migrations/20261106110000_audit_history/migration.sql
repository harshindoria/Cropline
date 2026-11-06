-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedByAdminId" TEXT;

-- AlterTable
-- A rename, so existing blocks keep their admin.
ALTER TABLE "UserRoleAccess" RENAME COLUMN "blockedByAdminId" TO "changedByAdminId";
ALTER TABLE "UserRoleAccess" RENAME CONSTRAINT "UserRoleAccess_blockedByAdminId_fkey" TO "UserRoleAccess_changedByAdminId_fkey";

-- CreateTable
CREATE TABLE "RoleAccessEvent" (
    "id" TEXT NOT NULL,
    "userRoleAccessId" TEXT NOT NULL,
    "fromStatus" "RoleAccessStatus",
    "toStatus" "RoleAccessStatus" NOT NULL,
    "reason" TEXT,
    "blockedUntil" TIMESTAMP(3),
    "changedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleAccessEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoleAccessEvent_userRoleAccessId_createdAt_idx" ON "RoleAccessEvent"("userRoleAccessId", "createdAt");

-- CreateIndex
CREATE INDEX "RoleAccessEvent_changedByAdminId_idx" ON "RoleAccessEvent"("changedByAdminId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "CashLiability_reconciledByAdminId_idx" ON "CashLiability"("reconciledByAdminId");

-- CreateIndex
CREATE INDEX "Complaint_resolvedByAdminId_idx" ON "Complaint"("resolvedByAdminId");

-- CreateIndex
CREATE INDEX "UserRoleAccess_changedByAdminId_idx" ON "UserRoleAccess"("changedByAdminId");

-- AddForeignKey
ALTER TABLE "RoleAccessEvent" ADD CONSTRAINT "RoleAccessEvent_userRoleAccessId_fkey" FOREIGN KEY ("userRoleAccessId") REFERENCES "UserRoleAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAccessEvent" ADD CONSTRAINT "RoleAccessEvent_changedByAdminId_fkey" FOREIGN KEY ("changedByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashLiability" ADD CONSTRAINT "CashLiability_reconciledByAdminId_fkey" FOREIGN KEY ("reconciledByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_resolvedByAdminId_fkey" FOREIGN KEY ("resolvedByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Every status an order has been in. Written here so no code path can forget or skip it.
CREATE FUNCTION "record_order_status"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "OrderStatusHistory" ("id", "orderId", "fromStatus", "toStatus")
    VALUES (gen_random_uuid()::text, NEW."id", NULL, NEW."status");
  ELSIF NEW."status" IS DISTINCT FROM OLD."status" THEN
    INSERT INTO "OrderStatusHistory" ("id", "orderId", "fromStatus", "toStatus")
    VALUES (gen_random_uuid()::text, NEW."id", OLD."status", NEW."status");
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER "Order_record_status"
AFTER INSERT OR UPDATE OF "status" ON "Order"
FOR EACH ROW EXECUTE FUNCTION "record_order_status"();

CREATE FUNCTION "order_status_history_is_permanent"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'OrderStatusHistory_permanent: order history cannot be changed or deleted'
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER "OrderStatusHistory_permanent"
BEFORE UPDATE OR DELETE ON "OrderStatusHistory"
FOR EACH ROW EXECUTE FUNCTION "order_status_history_is_permanent"();

-- Every change to a role's status, so a new block does not erase the one before it.
CREATE FUNCTION "record_role_access_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "RoleAccessEvent" ("id", "userRoleAccessId", "fromStatus", "toStatus", "reason", "blockedUntil", "changedByAdminId")
    VALUES (gen_random_uuid()::text, NEW."id", NULL, NEW."status", NEW."reason", NEW."blockedUntil", NEW."changedByAdminId");
  ELSIF NEW."status" IS DISTINCT FROM OLD."status"
    OR NEW."reason" IS DISTINCT FROM OLD."reason"
    OR NEW."blockedUntil" IS DISTINCT FROM OLD."blockedUntil" THEN
    INSERT INTO "RoleAccessEvent" ("id", "userRoleAccessId", "fromStatus", "toStatus", "reason", "blockedUntil", "changedByAdminId")
    VALUES (gen_random_uuid()::text, NEW."id", OLD."status", NEW."status", NEW."reason", NEW."blockedUntil", NEW."changedByAdminId");
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER "UserRoleAccess_record_change"
AFTER INSERT OR UPDATE ON "UserRoleAccess"
FOR EACH ROW EXECUTE FUNCTION "record_role_access_change"();

-- Rows that already exist get their current state as their first history entry.
INSERT INTO "OrderStatusHistory" ("id", "orderId", "toStatus", "createdAt")
SELECT gen_random_uuid()::text, "id", "status", "createdAt" FROM "Order";

INSERT INTO "RoleAccessEvent" ("id", "userRoleAccessId", "toStatus", "reason", "blockedUntil", "changedByAdminId", "createdAt")
SELECT gen_random_uuid()::text, "id", "status", "reason", "blockedUntil", "changedByAdminId", "createdAt" FROM "UserRoleAccess";
