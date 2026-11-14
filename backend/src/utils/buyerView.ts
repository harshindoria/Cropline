import { Prisma } from '@prisma/client';
import prisma from '../config/db';

// Buyers only ever see what they pay. The farmer's own price, the platform's
// markup and fees, and what the farmer and delivery partner are paid stay hidden.

type Amount = Prisma.Decimal | number | string;
const dec = (value: Amount) => new Prisma.Decimal(value);

// Rounded to paise the same way order totals are.
const withMarkup = (amount: Amount, markupRate: Amount) =>
  dec(amount).mul(dec(1).plus(dec(markupRate))).toDecimalPlaces(2).toNumber();

export const currentMarkupRate = async (): Promise<number> => {
  const settings = await prisma.platformSettings.findFirst();
  return settings ? Number(settings.cropMarkupRate) : 0.2;
};

// A crop as a buyer sees it: their price per kg instead of the farmer's.
export function cropForBuyer<T extends { basePricePerKg: Amount }>(crop: T, markupRate: Amount) {
  const { basePricePerKg, ...rest } = crop;
  return { ...rest, buyerPricePerKg: withMarkup(basePricePerKg, markupRate) };
}

type OrderMoney = {
  buyerId: string;
  farmerId: string;
  basePricePerKg: Amount;
  farmerEarnings: Amount;
  cropMarkupRate: Amount;
  platformFee: Amount;
  deliveryCommissionRate: Amount;
  deliveryPlatformFee: Amount;
  deliveryPartnerPayout: Amount;
  discountAmount: Amount;
};

// An order as its buyer sees it: price per kg and discount in the buyer's prices,
// the delivery fee and the total they pay.
export function orderForBuyer<T extends OrderMoney>(order: T) {
  const {
    basePricePerKg, farmerEarnings, cropMarkupRate, platformFee,
    deliveryCommissionRate, deliveryPlatformFee, deliveryPartnerPayout, discountAmount,
    ...rest
  } = order;
  return {
    ...rest,
    pricePerKg: withMarkup(basePricePerKg, cropMarkupRate),
    discountAmount: withMarkup(discountAmount, cropMarkupRate),
  };
}

// The buyer of an order gets the buyer view; the farmer keeps the full order.
export function orderForViewer<T extends OrderMoney>(order: T, viewerId: string) {
  return order.buyerId === viewerId && order.farmerId !== viewerId ? orderForBuyer(order) : order;
}
