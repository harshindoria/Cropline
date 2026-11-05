-- The app already takes the discount out of "farmerEarnings", so the old total rule subtracted
-- it a second time and rejected every discounted order.
--
-- These rules are dropped and re-added together because a database first built with `db push`
-- has none of them. This way every database ends up with the same four rules.
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_activeRole_in_roles_check";
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_money_non_negative_check";
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_total_buyer_price_check";
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_delivery_split_check";

ALTER TABLE "User" ADD CONSTRAINT "User_activeRole_in_roles_check" CHECK ("activeRole" = ANY("roles"));

ALTER TABLE "Order"
ADD CONSTRAINT "Order_money_non_negative_check" CHECK (
  "farmerEarnings" >= 0 AND "platformFee" >= 0 AND "deliveryFee" >= 0
  AND "deliveryPlatformFee" >= 0 AND "deliveryPartnerPayout" >= 0
  AND "discountAmount" >= 0 AND "totalBuyerPrice" >= 0
),
ADD CONSTRAINT "Order_total_buyer_price_check" CHECK (
  "totalBuyerPrice" = "farmerEarnings" + "platformFee" + "deliveryFee"
),
ADD CONSTRAINT "Order_delivery_split_check" CHECK (
  "deliveryFee" = "deliveryPlatformFee" + "deliveryPartnerPayout"
);
