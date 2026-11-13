import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeliveryType, PaymentType, Role } from '@prisma/client';
import prisma from '../src/config/db';
import { getDashboardOverview } from '../src/controller/admin.controller';
import { markDelivered } from '../src/controller/delivery.controller';
import { createDriverSettlementLink, razorpayWebhook } from '../src/controller/payment.controller';
import { createRazorpayPaymentLink, fetchRazorpayRefunds, issueRazorpayRefund } from '../src/services/payment.service';
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
  fetchRazorpayRefunds: vi.fn(),
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

const linkPaid = (entity: Record<string, unknown>, paymentId = 'pay_link_1') =>
  call(razorpayWebhook, {
    headers: { 'x-razorpay-signature': 'signed' },
    rawBody: 'raw',
    body: { event: 'payment_link.paid', payload: { payment_link: { entity }, payment: { entity: { id: paymentId } } } },
  });

// A link as createDriverSettlementLink makes it: its own unique reference, the partner in the notes.
const webhook = (liabilityId: string, driverId: string, paise: number, paymentId?: string) =>
  linkPaid({ reference_id: 'settle_abc123', amount_paid: paise, notes: { liabilityId, driverId } }, paymentId);

beforeEach(async () => {
  await resetDatabase();
  vi.mocked(issueRazorpayRefund).mockReset().mockResolvedValue({ id: 'rfnd_settle', amount: 0, status: 'pending' } as any);
  vi.mocked(fetchRazorpayRefunds).mockReset().mockResolvedValue([]);
});

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

  it('counts cash paid at the door as cash, not as an online payment', async () => {
    const cash = await setUp(PaymentType.CASH, 'PENDING');
    await deliver(cash.job.id, cash.partner);
    // A second order that really was paid online.
    const online = await setUp(PaymentType.ONLINE, 'PENDING');
    await prisma.paymentRecord.update({
      where: { orderId: online.order.id },
      data: { status: 'SUCCESS', providerPaymentId: 'pay_online' },
    });

    const result = await call(getTransactionsOverview, {});

    expect(result.body.data.onlinePayments).toBe(1010);
    expect(result.body.data.cashPendingDeposit).toBe(1010);
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
    const settled = await prisma.cashLiability.findUniqueOrThrow({ where: { id: liability.id } });
    expect(settled.status).toBe('VERIFIED');
    expect(settled.settlementPaymentId).toBe('pay_link_1');
    // The repeat is the same payment, not a second one, so nothing is refunded.
    expect(issueRazorpayRefund).not.toHaveBeenCalled();
  });

  it('releases everything when the partner settles all their dues at once', async () => {
    const { job, partner, farmer } = await setUp(PaymentType.CASH, 'PENDING');
    await deliver(job.id, partner);

    await webhook('ALL', partner.id, 101000);

    expect(await wallet(farmer.id)).toBe(800);
    expect(await wallet(partner.id)).toBe(40);
  });

  it('still settles a link made before the partner moved into the notes', async () => {
    const { job, order, farmer, partner } = await setUp(PaymentType.CASH, 'PENDING');
    await deliver(job.id, partner);
    const liability = await prisma.cashLiability.findUniqueOrThrow({ where: { orderId: order.id } });

    // Older links used the partner's ID as their reference and had no driverId note.
    await linkPaid({ reference_id: partner.id, amount_paid: 101000, notes: { liabilityId: liability.id } });

    expect(await wallet(farmer.id)).toBe(800);
  });

  it('gives every settlement link its own reference, so a partner can make a second one', async () => {
    const { job, order, partner } = await setUp(PaymentType.CASH, 'PENDING');
    await deliver(job.id, partner);
    const liability = await prisma.cashLiability.findUniqueOrThrow({ where: { orderId: order.id } });
    vi.mocked(createRazorpayPaymentLink).mockResolvedValue({ id: 'plink_1', short_url: 'https://rzp.io/x' } as any);
    const asPartner = { ...partner, activeRole: Role.DELIVERY };

    await call(createDriverSettlementLink, { user: asPartner, body: { liabilityId: liability.id } });
    await call(createDriverSettlementLink, { user: asPartner, body: { liabilityId: liability.id } });

    const [first, second] = vi.mocked(createRazorpayPaymentLink).mock.calls;
    expect(first[1]).not.toBe(second[1]);
    expect(first[1]).not.toBe(partner.id);
    expect(first[1].length).toBeLessThanOrEqual(40); // Razorpay's limit for reference_id
    expect(first[3]).toEqual({ liabilityId: liability.id, driverId: partner.id });
  });

  it('keeps holding when the payment link was underpaid, and refunds what was paid', async () => {
    const { job, order, farmer, partner } = await setUp(PaymentType.CASH, 'PENDING');
    await deliver(job.id, partner);
    const liability = await prisma.cashLiability.findUniqueOrThrow({ where: { orderId: order.id } });

    await webhook(liability.id, partner.id, 50000);

    expect(await wallet(farmer.id)).toBe(0);
    expect(await wallet(partner.id)).toBe(0);
    expect(issueRazorpayRefund).toHaveBeenCalledWith('pay_link_1', 500, expect.anything());
  });

  it('refunds a second payment for cash that is already settled, and tells the partner', async () => {
    const { job, order, partner } = await setUp(PaymentType.CASH, 'PENDING');
    await deliver(job.id, partner);
    const liability = await prisma.cashLiability.findUniqueOrThrow({ where: { orderId: order.id } });

    // The partner made two links for the same cash and paid both.
    await webhook(liability.id, partner.id, 101000, 'pay_link_1');
    const second = await webhook(liability.id, partner.id, 101000, 'pay_link_2');

    expect(second.status).toBe(200);
    expect(issueRazorpayRefund).toHaveBeenCalledTimes(1);
    expect(issueRazorpayRefund).toHaveBeenCalledWith('pay_link_2', 1010, expect.anything());
    expect(await prisma.notification.count({ where: { userId: partner.id, title: 'Extra settlement payment refunded' } })).toBe(1);
  });

  it('settles only the cash owed when the link was made, and refunds the rest', async () => {
    const first = await setUp(PaymentType.CASH, 'PENDING');
    await deliver(first.job.id, first.partner);
    const partner = first.partner;
    const old = await prisma.cashLiability.findUniqueOrThrow({ where: { orderId: first.order.id } });
    const linkCreatedAt = new Date(old.createdAt.getTime() + 1000);

    // After the link was made, an admin verified that cash, and the partner collected new cash.
    await prisma.cashLiability.update({ where: { id: old.id }, data: { status: 'VERIFIED', reconciledAt: new Date() } });
    const later = await setUp(PaymentType.CASH, 'PENDING');
    await deliver(later.job.id, later.partner);
    const fresh = await prisma.cashLiability.update({
      where: { orderId: later.order.id },
      data: { deliveryPartnerId: partner.id, createdAt: new Date(linkCreatedAt.getTime() + 60_000) },
    });

    await linkPaid({
      reference_id: 'settle_abc123',
      amount_paid: 101000,
      created_at: Math.floor(linkCreatedAt.getTime() / 1000),
      notes: { liabilityId: 'ALL', driverId: partner.id },
    });

    // The new cash was not part of what the partner chose to pay, so it stays open.
    expect((await prisma.cashLiability.findUniqueOrThrow({ where: { id: fresh.id } })).reconciledAt).toBeNull();
    expect(issueRazorpayRefund).toHaveBeenCalledWith('pay_link_1', 1010, expect.anything());
  });

  it('retries only the refund when the webhook repeats after a refund failed, and alerts admins once', async () => {
    const admin = await makeUser({ roles: [Role.ADMIN], activeRole: Role.ADMIN });
    const { job, order, partner } = await setUp(PaymentType.CASH, 'PENDING');
    await deliver(job.id, partner);
    const liability = await prisma.cashLiability.findUniqueOrThrow({ where: { orderId: order.id } });
    vi.mocked(issueRazorpayRefund).mockRejectedValue(new Error('Failed to issue refund via Razorpay: invalid request sent'));

    // Paid ₹1100 for ₹1010 of cash.
    expect((await webhook(liability.id, partner.id, 110000)).status).toBe(500);
    expect((await webhook(liability.id, partner.id, 110000)).status).toBe(500);

    expect(issueRazorpayRefund).toHaveBeenCalledTimes(2);
    expect(issueRazorpayRefund).toHaveBeenLastCalledWith('pay_link_1', 90, expect.anything());
    expect((await prisma.cashLiability.findUniqueOrThrow({ where: { id: liability.id } })).status).toBe('VERIFIED');
    expect(await prisma.notification.count({ where: { userId: admin.id, title: 'Settlement refund failed: partner money is held' } })).toBe(1);
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
