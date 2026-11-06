import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CropCategory, DeliveryType, PaymentType, Role } from '@prisma/client';
import prisma from '../src/config/db';
import { createOrder } from '../src/controller/order.controller';
import { makeCatalog, makeUser, resetDatabase } from './helpers';

vi.mock('../src/sockets/socket.handler', () => ({ disconnectUser: vi.fn(), getIO: vi.fn() }));
vi.mock('../src/services/deliveryAssignment.service', () => ({ broadcastDeliveryOffer: vi.fn() }));
vi.mock('../src/services/payment.service', () => ({ issueRazorpayRefund: vi.fn() }));

const setUpCrop = async (offer?: { minQuantityKg: number; discountPercentage: number }) => {
  const farmer = await makeUser({ roles: [Role.BUYER, Role.FARMER] });
  const catalog = await makeCatalog();
  return prisma.crop.create({
    data: {
      farmerId: farmer.id,
      catalogId: catalog.id,
      quantityKg: 200,
      quantityRemainingKg: 200,
      basePricePerKg: 10,
      minOrderKg: 1,
      harvestDate: new Date('2026-01-01'),
      farmLatitude: 26.9,
      farmLongitude: 75.8,
      farmVillage: 'Village',
      farmDistrict: 'District',
      farmState: 'State',
      ...(offer ? { offer: { create: offer } } : {}),
    },
  });
};

const placeOrder = async (cropId: string, quantityKg: number) => {
  const buyer = await makeUser();
  let status = 200;
  let body: any;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(data: unknown) {
      body = data;
      return this;
    },
  };
  await createOrder(
    {
      user: buyer,
      body: {
        cropId,
        quantityKg,
        deliveryType: DeliveryType.DELIVERY,
        paymentType: PaymentType.ONLINE,
        deliveryLatitude: 26.95,
        deliveryLongitude: 75.85,
        deliveryAddress: 'Address',
      },
    } as any,
    res as any,
  );
  return { status, body };
};

beforeEach(resetDatabase);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('order pricing', () => {
  it('saves a discounted order, with the discount taken off only once', async () => {
    const crop = await setUpCrop({ minQuantityKg: 50, discountPercentage: 20 });

    const result = await placeOrder(crop.id, 100);

    expect(result.status).toBe(201);
    const order = await prisma.order.findFirstOrThrow();
    const deliveryFee = Number(order.deliveryFee);
    expect(deliveryFee).toBeGreaterThan(0);
    expect(Number(order.discountAmount)).toBe(200);
    expect(Number(order.farmerEarnings)).toBe(800);
    expect(Number(order.platformFee)).toBe(160);
    expect(Number(order.totalBuyerPrice)).toBe(960 + deliveryFee);
  });

  it('saves an order that has no discount', async () => {
    const crop = await setUpCrop();

    const result = await placeOrder(crop.id, 100);

    expect(result.status).toBe(201);
    const order = await prisma.order.findFirstOrThrow();
    expect(Number(order.discountAmount)).toBe(0);
    expect(Number(order.totalBuyerPrice)).toBe(1200 + Number(order.deliveryFee));
  });

  it('gives no discount below the minimum quantity for the offer', async () => {
    const crop = await setUpCrop({ minQuantityKg: 50, discountPercentage: 20 });

    const result = await placeOrder(crop.id, 10);

    expect(result.status).toBe(201);
    expect(Number((await prisma.order.findFirstOrThrow()).discountAmount)).toBe(0);
  });
});

describe('database rules still catch bad data', () => {
  const orderData = async () => {
    const crop = await setUpCrop();
    const buyer = await makeUser();
    return {
      cropId: crop.id,
      farmerId: crop.farmerId,
      buyerId: buyer.id,
      quantityKg: 100,
      basePricePerKg: 10,
      farmerEarnings: 800,
      cropMarkupRate: 0.2,
      platformFee: 160,
      deliveryFee: 50,
      deliveryPlatformFee: 10,
      deliveryPartnerPayout: 40,
      discountAmount: 200,
      totalBuyerPrice: 1010,
      deliveryType: DeliveryType.DELIVERY,
      deliveryLatitude: 27,
      deliveryLongitude: 75.9,
      paymentType: PaymentType.ONLINE,
    };
  };

  it('rejects a total that does not add up', async () => {
    await expect(prisma.order.create({ data: { ...(await orderData()), totalBuyerPrice: 810 } })).rejects.toThrow(
      'Order_total_buyer_price_check',
    );
  });

  it('rejects a negative amount', async () => {
    await expect(
      prisma.order.create({ data: { ...(await orderData()), platformFee: -160, totalBuyerPrice: 690 } }),
    ).rejects.toThrow('Order_money_non_negative_check');
  });

  it('rejects a delivery fee that is not fully split', async () => {
    await expect(
      prisma.order.create({ data: { ...(await orderData()), deliveryPartnerPayout: 30 } }),
    ).rejects.toThrow('Order_delivery_split_check');
  });

  it('rejects an active role the user does not have', async () => {
    await expect(makeUser({ roles: [Role.BUYER], activeRole: Role.ADMIN })).rejects.toThrow(
      'User_activeRole_not_held',
    );
  });
});
