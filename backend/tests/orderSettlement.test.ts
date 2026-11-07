import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeliveryType, PaymentType, Role } from '@prisma/client';
import prisma from '../src/config/db';
import { getDashboardOverview } from '../src/controller/admin.controller';
import { markDelivered } from '../src/controller/delivery.controller';
import { razorpayWebhook } from '../src/controller/payment.controller';
import { getTransactionsOverview, verifyCashDeposit } from '../src/controller/transaction.controller';
import { makeCatalog, makeUser, resetDatabase } from './helpers';

vi.mock('../src/sockets/socket.handler', () => ({
  disconnectUser: vi.fn(),
  getIO: () => ({ to: () => ({ emit: vi.fn() }) }),
}));
vi.mock('../src/utils/cloudinaryUpload', () => ({ uploadToCloudinary: vi.fn(async () => 'photo-url') }));
vi.mock('../src/services/payment.service', () => ({
  verifyRazorpayWebhookSignature: () => true,
  createRazorpayPaymentLink: vi.fn(),
  createRazorpayOrder: vi.fn(),
  issueRazorpayRefund: vi.fn(),
}));

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

// Farmer ₹800 + platform ₹160 + delivery ₹50 (partner ₹40, platform ₹10) = buyer pays ₹1010.
const setUp = async (paymentType: PaymentType, paymentStatus: 'PENDING' | 'SUCCESS') => {
  const buyer = await makeUser();
  const farmer = await makeUser({ roles: [Role.BUYER, Role.FARMER] });
  const partner = await makeUser({ roles: [Role.BUYER, Role.DELIVERY] });
  const catalog = await makeCatalog();
  const crop = await prisma.crop.create({
    data: {
      farmerId: farmer.id,
      catalogId: catalog.id,
      quantityKg: 200,
      quantityRemainingKg: 100,
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
  const order = await prisma.order.create({
    data: {
      cropId: crop.id,
      buyerId: buyer.id,
      farmerId: farmer.id,
      quantityKg: 100,
      basePricePerKg: 10,
      farmerEarnings: 800,
      discountAmount: 200,
      cropMarkupRate: 0.2,
      platformFee: 160,
      deliveryFee: 50,
      deliveryCommissionRate: 0.2,
      deliveryPlatformFee: 10,
      deliveryPartnerPayout: 40,
      totalBuyerPrice: 1010,
      deliveryType: DeliveryType.DELIVERY,
      deliveryLatitude: 27,
      deliveryLongitude: 75.9,
      paymentType,
      status: 'IN_DELIVERY',
      otps: { create: { kind: 'DELIVERY', code: '1234' } },
      paymentRecord: { create: { provider: 'RAZORPAY', amount: 1010, status: paymentStatus } },
    },
  });
  const job = await prisma.deliveryJob.create({
    data: {
      orderId: order.id,
      deliveryPartnerId: partner.id,
      pickupLatitude: 26.9,
      pickupLongitude: 75.8,
      dropLatitude: 26.95,
      dropLongitude: 75.85,
      distanceKm: 5,
      cropWeightKg: 100,
      status: 'PICKED_UP',
    },
  });
  return { order, job, farmer, partner };
};

const deliver = (jobId: string, partner: { id: string }) =>
  call(markDelivered, { params: { jobId }, body: { token: '1234' }, file: { buffer: Buffer.from('x') }, user: partner });

const wallet = async (id: string) => Number((await prisma.user.findUniqueOrThrow({ where: { id } })).walletBalance);

const ledger = async () => {
  const rows = await prisma.ledgerEntry.findMany();
  return Object.fromEntries(rows.map((row) => [row.type, { status: row.status, amount: Number(row.amount), userId: row.userId }]));
};

const revenueToday = async () => {
  const result = await call(getDashboardOverview, {});
  return Number(result.body.data.metrics.revenueToday);
};

const webhook = (liabilityId: string, driverId: string, paise: number) =>
  call(razorpayWebhook, {
    headers: { 'x-razorpay-signature': 'signed' },
    rawBody: 'raw',
    body: {
      event: 'payment_link.paid',
      payload: { payment_link: { entity: { reference_id: driverId, amount_paid: paise, notes: { liabilityId } } } },
    },
  });

beforeEach(resetDatabase);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('online order delivered', () => {
  it('credits wallets at once and records every rupee in the ledger', async () => {
    const { job, farmer, partner } = await setUp(PaymentType.ONLINE, 'SUCCESS');

    const result = await deliver(job.id, partner);

    expect(result.status).toBe(200);
    expect(await wallet(farmer.id)).toBe(800);
    expect(await wallet(partner.id)).toBe(40);
    expect(await ledger()).toEqual({
      FARMER_EARNING: { status: 'AVAILABLE', amount: 800, userId: farmer.id },
      DELIVERY_EARNING: { status: 'AVAILABLE', amount: 40, userId: partner.id },
      PLATFORM_CROP_FEE: { status: 'SETTLED', amount: 160, userId: null },
      PLATFORM_DELIVERY_FEE: { status: 'SETTLED', amount: 10, userId: null },
    });
    expect(await prisma.cashLiability.count()).toBe(0);
  });

  it('shows the platform fees as revenue for admin', async () => {
    const { job, partner } = await setUp(PaymentType.ONLINE, 'SUCCESS');
    await deliver(job.id, partner);
    expect(await revenueToday()).toBe(170);
  });

  it('credits only once when the same delivery is confirmed twice at the same moment', async () => {
    const { job, farmer, partner } = await setUp(PaymentType.ONLINE, 'SUCCESS');

    const results = await Promise.all([deliver(job.id, partner), deliver(job.id, partner)]);

    expect(results.map((result) => result.status)).toContain(200);
    expect(results.filter((result) => result.status === 200)).toHaveLength(1);
    expect(await wallet(farmer.id)).toBe(800);
    expect(await wallet(partner.id)).toBe(40);
    expect(await prisma.ledgerEntry.count()).toBe(4);
  });
});

describe('cash order delivered', () => {
  it('holds all earnings and fees until the cash is deposited', async () => {
    const { job, order, farmer, partner } = await setUp(PaymentType.CASH, 'PENDING');

    const result = await deliver(job.id, partner);

    expect(result.status).toBe(200);
    expect(await wallet(farmer.id)).toBe(0);
    expect(await wallet(partner.id)).toBe(0);
    expect(Object.values(await ledger()).map((row) => row.status)).toEqual(['AWAITING_CASH', 'AWAITING_CASH', 'AWAITING_CASH', 'AWAITING_CASH']);
    const liability = await prisma.cashLiability.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(Number(liability.amount)).toBe(1010);
    expect(await revenueToday()).toBe(0);
  });

  it('counts only earnings as pending settlements for admin', async () => {
    const { job, partner } = await setUp(PaymentType.CASH, 'PENDING');
    await deliver(job.id, partner);

    const result = await call(getTransactionsOverview, {});

    expect(result.body.data.pendingSettlements).toBe(840);
    expect(result.body.data.pendingSettlementsCount).toBe(2);
  });

  it('releases everything when admin verifies the deposit, and only once', async () => {
    const { job, order, farmer, partner } = await setUp(PaymentType.CASH, 'PENDING');
    await deliver(job.id, partner);
    const liability = await prisma.cashLiability.findUniqueOrThrow({ where: { orderId: order.id } });
    const admin = await makeUser({ roles: [Role.ADMIN], activeRole: Role.ADMIN });

    const first = await call(verifyCashDeposit, { params: { id: liability.id }, user: admin });
    const second = await call(verifyCashDeposit, { params: { id: liability.id }, user: admin });

    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
    expect(await wallet(farmer.id)).toBe(800);
    expect(await wallet(partner.id)).toBe(40);
    expect(await ledger()).toMatchObject({
      FARMER_EARNING: { status: 'AVAILABLE' },
      DELIVERY_EARNING: { status: 'AVAILABLE' },
      PLATFORM_CROP_FEE: { status: 'SETTLED' },
      PLATFORM_DELIVERY_FEE: { status: 'SETTLED' },
    });
    expect(await revenueToday()).toBe(170);
  });

  it('releases only once when two admins verify at the same moment', async () => {
    const { job, order, farmer, partner } = await setUp(PaymentType.CASH, 'PENDING');
    await deliver(job.id, partner);
    const liability = await prisma.cashLiability.findUniqueOrThrow({ where: { orderId: order.id } });
    const admin = await makeUser({ roles: [Role.ADMIN], activeRole: Role.ADMIN });

    await Promise.all([
      call(verifyCashDeposit, { params: { id: liability.id }, user: admin }),
      call(verifyCashDeposit, { params: { id: liability.id }, user: admin }),
    ]);

    expect(await wallet(farmer.id)).toBe(800);
    expect(await wallet(partner.id)).toBe(40);
  });

  it('releases everything when the partner pays through a payment link, even if the webhook repeats', async () => {
    const { job, order, farmer, partner } = await setUp(PaymentType.CASH, 'PENDING');
    await deliver(job.id, partner);
    const liability = await prisma.cashLiability.findUniqueOrThrow({ where: { orderId: order.id } });

    await webhook(liability.id, partner.id, 101000);
    await webhook(liability.id, partner.id, 101000);

    expect(await wallet(farmer.id)).toBe(800);
    expect(await wallet(partner.id)).toBe(40);
    expect((await prisma.cashLiability.findUniqueOrThrow({ where: { id: liability.id } })).status).toBe('VERIFIED');
  });

  it('releases everything when the partner settles all their dues at once', async () => {
    const { job, partner, farmer } = await setUp(PaymentType.CASH, 'PENDING');
    await deliver(job.id, partner);

    await webhook('ALL', partner.id, 101000);

    expect(await wallet(farmer.id)).toBe(800);
    expect(await wallet(partner.id)).toBe(40);
  });

  it('keeps holding when the payment link was underpaid', async () => {
    const { job, order, farmer, partner } = await setUp(PaymentType.CASH, 'PENDING');
    await deliver(job.id, partner);
    const liability = await prisma.cashLiability.findUniqueOrThrow({ where: { orderId: order.id } });

    await webhook(liability.id, partner.id, 50000);

    expect(await wallet(farmer.id)).toBe(0);
    expect(await wallet(partner.id)).toBe(0);
  });
});

describe('cash order the buyer already paid online at the door', () => {
  it('asks the partner for no cash and credits wallets at once', async () => {
    const { job, farmer, partner } = await setUp(PaymentType.CASH, 'SUCCESS');

    const result = await deliver(job.id, partner);

    expect(result.status).toBe(200);
    expect(await prisma.cashLiability.count()).toBe(0);
    expect(await wallet(farmer.id)).toBe(800);
    expect(await wallet(partner.id)).toBe(40);
  });
});
