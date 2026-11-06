import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CropCategory, DeliveryType, OrderStatus, PaymentType, Prisma, Role } from '@prisma/client';
import prisma from '../src/config/db';
import { getBuyers, getFarmers } from '../src/controller/admin.controller';
import { createOrder } from '../src/controller/order.controller';
import { makeCatalog, makeUser, resetDatabase } from './helpers';

vi.mock('../src/sockets/socket.handler', () => ({ disconnectUser: vi.fn(), getIO: vi.fn() }));
vi.mock('../src/services/deliveryAssignment.service', () => ({ broadcastDeliveryOffer: vi.fn() }));
vi.mock('../src/services/payment.service', () => ({ issueRazorpayRefund: vi.fn() }));

const call = async (handler: (req: any, res: any) => Promise<void>, req: Record<string, unknown>) => {
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
  await handler(req, res);
  return { status, body };
};

const makeCrop = async (farmerId: string) => {
  const catalog = await makeCatalog();
  return prisma.crop.create({
    data: {
      farmerId,
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
    },
  });
};

const makeOrder = async (
  buyerId: string,
  farmerId: string,
  data: Partial<Prisma.OrderUncheckedCreateInput> = {},
) => {
  const crop = await makeCrop(farmerId);
  return prisma.order.create({
    data: {
      cropId: crop.id,
      buyerId,
      farmerId,
      quantityKg: 10,
      basePricePerKg: 10,
      farmerEarnings: 100,
      cropMarkupRate: 0.2,
      platformFee: 20,
      totalBuyerPrice: 120,
      deliveryType: DeliveryType.SELF_PICKUP,
      paymentType: PaymentType.ONLINE,
      ...data,
    },
  });
};

beforeEach(resetDatabase);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('platform fee rates', () => {
  it('keeps a rate like 12.5% exact and charges it on the order', async () => {
    await prisma.platformSettings.create({ data: { cropMarkupRate: 0.125, deliveryMarkupRate: 0.125 } });
    const farmer = await makeUser({ roles: [Role.BUYER, Role.FARMER] });
    const crop = await makeCrop(farmer.id);
    const buyer = await makeUser();

    const result = await call(createOrder, {
      user: buyer,
      body: {
        cropId: crop.id,
        quantityKg: 80,
        deliveryType: DeliveryType.DELIVERY,
        paymentType: PaymentType.ONLINE,
        deliveryLatitude: 26.95,
        deliveryLongitude: 75.85,
        deliveryAddress: 'Address',
      },
    });

    expect(result.status).toBe(201);
    const settings = await prisma.platformSettings.findFirstOrThrow();
    expect(Number(settings.cropMarkupRate)).toBe(0.125);
    const order = await prisma.order.findFirstOrThrow();
    expect(Number(order.cropMarkupRate)).toBe(0.125);
    expect(Number(order.platformFee)).toBe(100);
  });
});

describe('payment records', () => {
  const makePaymentRecord = async (data: Partial<Prisma.PaymentRecordUncheckedCreateInput> = {}) => {
    const order = await makeOrder((await makeUser()).id, (await makeUser()).id);
    return prisma.paymentRecord.create({
      data: { orderId: order.id, provider: 'RAZORPAY', amount: 120, ...data },
    });
  };

  it('rejects two records with the same provider order id', async () => {
    await makePaymentRecord({ providerOrderId: 'order_1' });
    await expect(makePaymentRecord({ providerOrderId: 'order_1' })).rejects.toThrow();
  });

  it('rejects two records with the same provider payment id', async () => {
    await makePaymentRecord({ providerPaymentId: 'pay_1' });
    await expect(makePaymentRecord({ providerPaymentId: 'pay_1' })).rejects.toThrow();
  });

  it('allows many records that have no provider ids yet, like cash orders', async () => {
    await makePaymentRecord();
    await makePaymentRecord();
    expect(await prisma.paymentRecord.count()).toBe(2);
  });

  it('blocks deleting an order that has a payment record, and keeps the record', async () => {
    const record = await makePaymentRecord();

    await expect(prisma.order.delete({ where: { id: record.orderId } })).rejects.toThrow();

    expect(await prisma.paymentRecord.count({ where: { id: record.id } })).toBe(1);
    expect(await prisma.order.count({ where: { id: record.orderId } })).toBe(1);
  });
});

describe('admin order stats', () => {
  const setUpOrders = async () => {
    const buyer = await makeUser();
    const farmer = await makeUser({ roles: [Role.BUYER, Role.FARMER] });
    const statuses: OrderStatus[] = [
      OrderStatus.DELIVERED,
      OrderStatus.COMPLETED,
      OrderStatus.CANCELLED,
      OrderStatus.PENDING,
    ];
    for (const status of statuses) await makeOrder(buyer.id, farmer.id, { status });
    return { buyer, farmer };
  };

  it("counts delivered and completed orders in a buyer's totals, and nothing else", async () => {
    const { buyer } = await setUpOrders();

    const result = await call(getBuyers, {});

    const row = result.body.buyers.find((candidate: any) => candidate.id === buyer.id);
    expect(row.totalOrders).toBe(2);
    expect(row.totalSpent).toBe(240);
  });

  it("counts delivered and completed orders in a farmer's totals, and nothing else", async () => {
    const { farmer } = await setUpOrders();

    const result = await call(getFarmers, {});

    const row = result.body.farmers.find((candidate: any) => candidate.id === farmer.id);
    expect(row.totalOrders).toBe(2);
    expect(row.earnings).toBe(200);
  });
});

describe('indexes', () => {
  it.each([
    'Order_cropId_idx',
    'Order_status_createdAt_idx',
    'Review_reviewerId_idx',
    'Complaint_orderId_idx',
    'Complaint_complainerId_idx',
    'Complaint_status_idx',
  ])('has %s', async (name) => {
    const rows = await prisma.$queryRaw<unknown[]>`SELECT 1 FROM pg_indexes WHERE indexname = ${name}`;
    expect(rows).toHaveLength(1);
  });
});
