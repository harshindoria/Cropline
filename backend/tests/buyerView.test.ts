import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { cropForBuyer, orderForBuyer, orderForViewer } from '../src/utils/buyerView';

const d = (v: string) => new Prisma.Decimal(v);

const order = {
  id: 'o1',
  buyerId: 'buyer',
  farmerId: 'farmer',
  quantityKg: d('10'),
  basePricePerKg: d('50'),
  farmerEarnings: d('450'),
  cropMarkupRate: d('0.2'),
  platformFee: d('90'),
  deliveryFee: d('70'),
  deliveryCommissionRate: d('0.2'),
  deliveryPlatformFee: d('14'),
  deliveryPartnerPayout: d('56'),
  discountAmount: d('50'),
  totalBuyerPrice: d('610'),
};

const PRIVATE = ['basePricePerKg', 'farmerEarnings', 'cropMarkupRate', 'platformFee',
  'deliveryCommissionRate', 'deliveryPlatformFee', 'deliveryPartnerPayout'];

describe('buyer view of prices', () => {
  it('hides the farmer price, platform cut and payouts from the buyer', () => {
    const seen = orderForBuyer(order);
    for (const field of PRIVATE) expect(seen).not.toHaveProperty(field);
  });

  it('shows the buyer their own price, discount, delivery fee and total', () => {
    const seen = orderForBuyer(order);
    expect(seen.pricePerKg).toBe(60);
    expect(seen.discountAmount).toBe(60);
    expect(Number(seen.deliveryFee)).toBe(70);
    // 10 kg x 60 - 60 discount + 70 delivery = 610, the amount actually charged.
    expect(seen.pricePerKg * 10 - seen.discountAmount + Number(seen.deliveryFee)).toBe(Number(seen.totalBuyerPrice));
  });

  it('gives the buyer the buyer view and the farmer the full order', () => {
    expect(orderForViewer(order, 'buyer')).not.toHaveProperty('platformFee');
    expect(orderForViewer(order, 'farmer')).toHaveProperty('platformFee');
  });

  it('shows crops in buyer prices only', () => {
    const crop = cropForBuyer({ id: 'c1', basePricePerKg: d('33.33') }, 0.2);
    expect(crop).not.toHaveProperty('basePricePerKg');
    expect(crop.buyerPricePerKg).toBe(40);
  });
});
