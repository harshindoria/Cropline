import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeliveryType, PaymentType, Role } from '@prisma/client';
import prisma from '../src/config/db';
import { createCatalogItem } from '../src/controller/admin.catalog.controller';
import { makeCatalog, makeUser, resetDatabase } from './helpers';

vi.mock('../src/utils/cloudinaryUpload', () => ({ uploadToCloudinary: vi.fn() }));

const cropData = async (farmerId: string) => ({
  farmerId,
  catalogId: (await makeCatalog()).id,
  quantityKg: 100,
  quantityRemainingKg: 100,
  basePricePerKg: 10,
  minOrderKg: 1,
  harvestDate: new Date('2026-12-25'),
  farmLatitude: 26.9,
  farmLongitude: 75.8,
  farmVillage: 'Village',
  farmDistrict: 'District',
  farmState: 'State',
});

const orderData = (cropId: string, farmerId: string, buyerId: string) => ({
  cropId,
  farmerId,
  buyerId,
  quantityKg: 10,
  basePricePerKg: 10,
  farmerEarnings: 100,
  cropMarkupRate: 0.2,
  platformFee: 20,
  totalBuyerPrice: 120,
  deliveryType: DeliveryType.SELF_PICKUP,
  paymentType: PaymentType.CASH,
});

const setUpOrder = async () => {
  const farmer = await makeUser();
  const buyer = await makeUser();
  const crop = await prisma.crop.create({ data: await cropData(farmer.id) });
  return { farmer, buyer, crop, order: await prisma.order.create({ data: orderData(crop.id, farmer.id, buyer.id) }) };
};

beforeEach(() => resetDatabase());
afterAll(() => prisma.$disconnect());

describe('crops', () => {
  it.each([
    ['stock above the total', { quantityRemainingKg: 101 }],
    ['negative stock', { quantityRemainingKg: -1 }],
    ['a zero price', { basePricePerKg: 0 }],
    ['a zero minimum order', { minOrderKg: 0 }],
  ])('rejects %s', async (_label, bad) => {
    const farmer = await makeUser();
    await expect(prisma.crop.create({ data: { ...(await cropData(farmer.id)), ...bad } })).rejects.toThrow('Crop_');
  });

  it('stops a double cancellation from restoring stock twice', async () => {
    const farmer = await makeUser();
    const crop = await prisma.crop.create({ data: await cropData(farmer.id) });
    await expect(
      prisma.crop.update({ where: { id: crop.id }, data: { quantityRemainingKg: { increment: 10 } } }),
    ).rejects.toThrow('Crop_stock_check');
  });

  it('stores the harvest date without a time', async () => {
    const farmer = await makeUser();
    const crop = await prisma.crop.create({ data: { ...(await cropData(farmer.id)), harvestDate: new Date('2026-12-25T15:30:00Z') } });
    const saved = await prisma.crop.findUniqueOrThrow({ where: { id: crop.id } });
    expect(saved.harvestDate.toISOString()).toBe('2026-12-25T00:00:00.000Z');
  });

  it.each([[0], [101]])('rejects a %i%% discount', async (discountPercentage) => {
    const farmer = await makeUser();
    const crop = await prisma.crop.create({ data: await cropData(farmer.id) });
    await expect(
      prisma.cropOffer.create({ data: { cropId: crop.id, minQuantityKg: 10, discountPercentage } }),
    ).rejects.toThrow('CropOffer_values_check');
  });
});

describe('orders', () => {
  it('rejects buying from yourself', async () => {
    const farmer = await makeUser();
    const crop = await prisma.crop.create({ data: await cropData(farmer.id) });
    await expect(prisma.order.create({ data: orderData(crop.id, farmer.id, farmer.id) })).rejects.toThrow(
      'Order_buyer_not_farmer_check',
    );
  });

  it('rejects a delivery order with no location, but not a self pickup', async () => {
    const { farmer, buyer, crop } = await setUpOrder();
    await expect(
      prisma.order.create({ data: { ...orderData(crop.id, farmer.id, buyer.id), deliveryType: DeliveryType.DELIVERY } }),
    ).rejects.toThrow('Order_delivery_location_check');
  });

  it('rejects a zero quantity', async () => {
    const { farmer, buyer, crop } = await setUpOrder();
    await expect(
      prisma.order.create({ data: { ...orderData(crop.id, farmer.id, buyer.id), quantityKg: 0 } }),
    ).rejects.toThrow('Order_quantity_check');
  });
});

describe('reviews and complaints', () => {
  const review = (orderId: string, reviewerId: string, targetId: string, rating: number) =>
    prisma.review.create({ data: { orderId, reviewerId, targetId, targetType: 'FARMER', rating } });

  it.each([[0], [6]])('rejects a rating of %i', async (rating) => {
    const { order, buyer, farmer } = await setUpOrder();
    await expect(review(order.id, buyer.id, farmer.id, rating)).rejects.toThrow('Review_rating_check');
  });

  it('rejects reviewing yourself', async () => {
    const { order, buyer } = await setUpOrder();
    await expect(review(order.id, buyer.id, buyer.id, 5)).rejects.toThrow('Review_not_self_check');
  });

  it('rejects a complaint against yourself', async () => {
    const user = await makeUser();
    await expect(
      prisma.complaint.create({ data: { complainerId: user.id, accusedId: user.id, accusedRole: Role.BUYER, reason: 'x' } }),
    ).rejects.toThrow('Complaint_not_self_check');
  });
});

describe('money rows', () => {
  it('rejects a negative payment, attempt or cash amount, and a zero refund', async () => {
    const { order, farmer } = await setUpOrder();
    await expect(
      prisma.paymentRecord.create({ data: { orderId: order.id, provider: 'RAZORPAY', amount: -1 } }),
    ).rejects.toThrow('PaymentRecord_amount_check');

    const record = await prisma.paymentRecord.create({ data: { orderId: order.id, provider: 'RAZORPAY', amount: 120 } });
    await expect(
      prisma.paymentAttempt.create({ data: { paymentRecordId: record.id, providerPaymentId: 'p', status: 'FAILED', amount: -1 } }),
    ).rejects.toThrow('PaymentAttempt_amount_check');
    await expect(
      prisma.refund.create({ data: { paymentRecordId: record.id, providerRefundId: 'r', amount: 0 } }),
    ).rejects.toThrow('Refund_amount_check');
    await expect(
      prisma.cashLiability.create({ data: { orderId: order.id, deliveryPartnerId: farmer.id, amount: -1 } }),
    ).rejects.toThrow('CashLiability_amount_check');
  });

  it('allows only one pending payout per user at the database level', async () => {
    const user = await makeUser();
    const payout = (key: string) =>
      prisma.ledgerEntry.create({ data: { userId: user.id, type: 'PAYOUT', amount: 1, idempotencyKey: key } });
    const first = await payout('a');
    await expect(payout('b')).rejects.toThrow();

    await prisma.ledgerEntry.update({ where: { id: first.id }, data: { status: 'FAILED' } });
    await expect(payout('b')).resolves.toBeTruthy();
  });
});

describe('settings and catalog', () => {
  it('allows only one row of platform settings', async () => {
    await prisma.platformSettings.create({ data: {} });
    await expect(prisma.platformSettings.create({ data: {} })).rejects.toThrow();
  });

  it('answers 409 when a crop name already exists', async () => {
    await makeCatalog();
    let status = 200;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json() {
        return this;
      },
    };

    await createCatalogItem(
      { body: { englishName: 'Potato', hindiName: 'Aloo', category: 'VEGETABLES' } } as any,
      res as any,
    );

    expect(status).toBe(409);
  });
});

describe('timestamps', () => {
  it('keeps the exact moment', async () => {
    const user = await makeUser();
    const at = new Date('2026-11-06T10:15:30.123Z');
    const notification = await prisma.notification.create({ data: { userId: user.id, title: 't', body: 'b', createdAt: at } });
    expect(notification.createdAt.toISOString()).toBe(at.toISOString());
  });
});
