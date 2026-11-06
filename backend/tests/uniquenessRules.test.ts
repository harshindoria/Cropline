import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CropCategory,
  DeliveryJobStatus,
  DeliveryType,
  OrderStatus,
  PaymentStatus,
  PaymentType,
  ReviewTargetType,
} from '@prisma/client';
import prisma from '../src/config/db';
import { getOrderById } from '../src/controller/order.controller';
import { submitReview } from '../src/controller/review.controller';
import { issueRazorpayRefund } from '../src/services/payment.service';
import {
  applyProcessedRefund,
  markPaymentFailed,
  markPaymentSucceeded,
  refundFullPayment,
} from '../src/services/paymentRecord.service';
import { makeUser, resetDatabase } from './helpers';

vi.mock('../src/services/payment.service', () => ({ issueRazorpayRefund: vi.fn() }));
vi.mock('../src/sockets/socket.handler', () => ({ disconnectUser: vi.fn(), getIO: vi.fn() }));
vi.mock('../src/services/deliveryAssignment.service', () => ({ broadcastDeliveryOffer: vi.fn() }));

const call = async (req: Record<string, unknown>, handler: (req: any, res: any) => Promise<void> = submitReview) => {
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

const makeOrder = async (farmerId: string, buyerId: string, status: OrderStatus = OrderStatus.DELIVERED) => {
  const catalog = await prisma.cropCatalog.create({
    data: { englishName: 'Potato', hindiName: 'Aloo', category: CropCategory.VEGETABLES },
  });
  const crop = await prisma.crop.create({
    data: {
      farmerId,
      catalogId: catalog.id,
      quantityKg: 200,
      quantityRemainingKg: 200,
      basePricePerKg: 10,
      minOrderKg: 1,
      harvestDate: new Date(),
      farmLatitude: 26.9,
      farmLongitude: 75.8,
      farmVillage: 'Village',
      farmDistrict: 'District',
      farmState: 'State',
    },
  });
  return prisma.order.create({
    data: {
      cropId: crop.id,
      farmerId,
      buyerId,
      status,
      quantityKg: 10,
      basePricePerKg: 10,
      farmerEarnings: 100,
      cropMarkupRate: 0.2,
      platformFee: 20,
      totalBuyerPrice: 120,
      deliveryType: DeliveryType.DELIVERY,
      paymentType: PaymentType.ONLINE,
    },
  });
};

const jobData = (orderId: string, deliveryPartnerId: string) => ({
  orderId,
  deliveryPartnerId,
  pickupLatitude: 26.9,
  pickupLongitude: 75.8,
  dropLatitude: 27,
  dropLongitude: 75.9,
  distanceKm: 10,
  cropWeightKg: 10,
});

beforeEach(async () => {
  await resetDatabase();
  vi.mocked(issueRazorpayRefund).mockReset();
});

afterAll(() => prisma.$disconnect());

describe('delivery jobs', () => {
  it('rejects a second live job on an order with the same error acceptJob handles', async () => {
    const order = await makeOrder((await makeUser()).id, (await makeUser()).id, OrderStatus.ASSIGNED);
    const partner = await makeUser();
    await prisma.deliveryJob.create({ data: jobData(order.id, partner.id) });

    await expect(prisma.deliveryJob.create({ data: jobData(order.id, (await makeUser()).id) })).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('allows a new job after the old one is cancelled, and keeps the old one', async () => {
    const order = await makeOrder((await makeUser()).id, (await makeUser()).id, OrderStatus.ASSIGNED);
    const first = await prisma.deliveryJob.create({ data: jobData(order.id, (await makeUser()).id) });
    await prisma.deliveryJob.update({
      where: { id: first.id },
      data: { status: DeliveryJobStatus.CANCELLED, cancelledAt: new Date() },
    });

    await prisma.deliveryJob.create({ data: jobData(order.id, (await makeUser()).id) });

    expect(await prisma.deliveryJob.count({ where: { orderId: order.id } })).toBe(2);
  });

  it('rejects a cancelled job with no cancellation time', async () => {
    const order = await makeOrder((await makeUser()).id, (await makeUser()).id, OrderStatus.ASSIGNED);
    const job = await prisma.deliveryJob.create({ data: jobData(order.id, (await makeUser()).id) });

    await expect(
      prisma.deliveryJob.update({ where: { id: job.id }, data: { status: DeliveryJobStatus.CANCELLED } }),
    ).rejects.toThrow();
  });
});

describe('order API', () => {
  it('returns the live job as deliveryJob and leaves out the cancelled one', async () => {
    const buyer = await makeUser();
    const order = await makeOrder((await makeUser()).id, buyer.id, OrderStatus.ASSIGNED);
    const live = await makeUser();
    await prisma.deliveryJob.create({
      data: { ...jobData(order.id, (await makeUser()).id), status: DeliveryJobStatus.CANCELLED, cancelledAt: new Date() },
    });
    await prisma.deliveryJob.create({ data: jobData(order.id, live.id) });

    const { body } = await call({ user: { id: buyer.id }, params: { id: order.id } }, getOrderById);

    expect(body.order.deliveryJob.deliveryPartnerId).toBe(live.id);
    expect(body.order.deliveryJobs).toBeUndefined();
  });
});

describe('delivery offers', () => {
  const offer = (orderId: string, partnerId: string, wave: number) => ({
    orderId,
    partnerId,
    wave,
    radiusKm: 10,
    expiresAt: new Date(Date.now() + 60_000),
  });

  it('lets a partner be offered again in a later wave, but only once per wave', async () => {
    const order = await makeOrder((await makeUser()).id, (await makeUser()).id, OrderStatus.DELIVERY_SEARCHING);
    const partner = await makeUser();

    await prisma.deliveryOffer.create({ data: offer(order.id, partner.id, 1) });
    await prisma.deliveryOffer.create({ data: offer(order.id, partner.id, 2) });

    await expect(prisma.deliveryOffer.create({ data: offer(order.id, partner.id, 2) })).rejects.toThrow();
  });
});

describe('reviews', () => {
  const review = (reviewerId: string, orderId: unknown, targetId: string, targetType = ReviewTargetType.FARMER) =>
    call({ user: { id: reviewerId }, body: { orderId, targetId, targetType, rating: 4 } });

  it('lets a buyer review the same farmer once for each order', async () => {
    const farmer = await makeUser();
    const buyer = await makeUser();
    const first = await makeOrder(farmer.id, buyer.id);
    const second = await makeOrder(farmer.id, buyer.id);

    expect((await review(buyer.id, first.id, farmer.id)).status).toBe(201);
    expect((await review(buyer.id, second.id, farmer.id)).status).toBe(201);
    expect((await review(buyer.id, first.id, farmer.id)).status).toBe(400);
    expect(await prisma.review.count()).toBe(2);
  });

  it('requires an order', async () => {
    const buyer = await makeUser();
    expect((await review(buyer.id, undefined, (await makeUser()).id)).status).toBe(400);
  });

  it('rejects an order that is not delivered yet', async () => {
    const farmer = await makeUser();
    const buyer = await makeUser();
    const order = await makeOrder(farmer.id, buyer.id, OrderStatus.CONFIRMED);
    expect((await review(buyer.id, order.id, farmer.id)).status).toBe(400);
  });

  it('rejects someone who is not part of the order', async () => {
    const farmer = await makeUser();
    const buyer = await makeUser();
    const order = await makeOrder(farmer.id, buyer.id);
    expect((await review(buyer.id, order.id, (await makeUser()).id)).status).toBe(400);
    expect((await review(buyer.id, order.id, (await makeUser()).id, ReviewTargetType.DELIVERY)).status).toBe(400);
  });

  it('accepts the partner who delivered the order, but not one whose job was cancelled', async () => {
    const buyer = await makeUser();
    const order = await makeOrder((await makeUser()).id, buyer.id);
    const cancelled = await makeUser();
    const delivered = await makeUser();
    await prisma.deliveryJob.create({
      data: { ...jobData(order.id, cancelled.id), status: DeliveryJobStatus.CANCELLED, cancelledAt: new Date() },
    });
    await prisma.deliveryJob.create({
      data: { ...jobData(order.id, delivered.id), status: DeliveryJobStatus.DELIVERED },
    });

    expect((await review(buyer.id, order.id, cancelled.id, ReviewTargetType.DELIVERY)).status).toBe(400);
    expect((await review(buyer.id, order.id, delivered.id, ReviewTargetType.DELIVERY)).status).toBe(201);
  });
});

describe('payment attempts and refunds', () => {
  const makeRecord = async (data: { status?: PaymentStatus; providerPaymentId?: string } = {}) => {
    const order = await makeOrder((await makeUser()).id, (await makeUser()).id);
    return prisma.paymentRecord.create({
      data: { orderId: order.id, provider: 'RAZORPAY', providerOrderId: `order_${order.id}`, amount: 120, ...data },
    });
  };
  const load = (id: string) => prisma.paymentRecord.findUniqueOrThrow({ where: { id } });

  it('keeps a failed attempt and the later successful one', async () => {
    const record = await makeRecord();

    await markPaymentFailed(record.providerOrderId!, 'pay_failed', 'Card declined');
    expect((await load(record.id)).status).toBe(PaymentStatus.FAILED);

    await markPaymentSucceeded(record.providerOrderId!, 'pay_ok');
    const after = await load(record.id);
    expect(after.status).toBe(PaymentStatus.SUCCESS);
    expect(after.providerPaymentId).toBe('pay_ok');

    const attempts = await prisma.paymentAttempt.findMany({ where: { paymentRecordId: record.id } });
    expect(attempts.map((a) => a.status).sort()).toEqual([PaymentStatus.FAILED, PaymentStatus.SUCCESS].sort());
  });

  it('does not let a late failure undo a successful payment', async () => {
    const record = await makeRecord();
    await markPaymentSucceeded(record.providerOrderId!, 'pay_ok');
    await markPaymentFailed(record.providerOrderId!, 'pay_old');
    expect((await load(record.id)).status).toBe(PaymentStatus.SUCCESS);
  });

  it('records one attempt when checkout and the webhook report the same payment', async () => {
    const record = await makeRecord();
    await markPaymentSucceeded(record.providerOrderId!, 'pay_ok');
    await markPaymentSucceeded(record.providerOrderId!, 'pay_ok');
    expect(await prisma.paymentAttempt.count({ where: { paymentRecordId: record.id } })).toBe(1);
  });

  it('does not mark a partial refund as fully refunded', async () => {
    const record = await makeRecord({ status: PaymentStatus.SUCCESS, providerPaymentId: 'pay_1' });

    await applyProcessedRefund({ id: 'rfnd_1', payment_id: 'pay_1', amount: 5000 });

    const after = await load(record.id);
    expect(after.status).toBe(PaymentStatus.SUCCESS);
    expect(after.refundedAt).toBeNull();
  });

  it('marks the payment refunded once the partial refunds add up to the full amount', async () => {
    const record = await makeRecord({ status: PaymentStatus.SUCCESS, providerPaymentId: 'pay_1' });

    await applyProcessedRefund({ id: 'rfnd_1', payment_id: 'pay_1', amount: 5000 });
    await applyProcessedRefund({ id: 'rfnd_2', payment_id: 'pay_1', amount: 7000 });

    expect((await load(record.id)).status).toBe(PaymentStatus.REFUNDED);
    expect(await prisma.refund.count({ where: { paymentRecordId: record.id } })).toBe(2);
  });

  it('counts a repeated refund webhook once', async () => {
    const record = await makeRecord({ status: PaymentStatus.SUCCESS, providerPaymentId: 'pay_1' });

    await applyProcessedRefund({ id: 'rfnd_1', payment_id: 'pay_1', amount: 5000 });
    await applyProcessedRefund({ id: 'rfnd_1', payment_id: 'pay_1', amount: 5000 });

    expect(await prisma.refund.count({ where: { paymentRecordId: record.id } })).toBe(1);
    expect((await load(record.id)).status).toBe(PaymentStatus.SUCCESS);
  });

  it('records a full refund, and its webhook confirms the same row', async () => {
    const record = await makeRecord({ status: PaymentStatus.SUCCESS, providerPaymentId: 'pay_1' });
    vi.mocked(issueRazorpayRefund).mockResolvedValue({ id: 'rfnd_1', amount: 12000, status: 'pending' } as any);

    await prisma.$transaction((tx) => refundFullPayment(tx, record, 'Order cancelled'));
    await applyProcessedRefund({ id: 'rfnd_1', payment_id: 'pay_1', amount: 12000 });

    const refund = await prisma.refund.findUniqueOrThrow({ where: { providerRefundId: 'rfnd_1' } });
    expect(Number(refund.amount)).toBe(120);
    expect(refund.status).toBe('PROCESSED');
    expect(refund.reason).toBe('Order cancelled');
    expect((await load(record.id)).status).toBe(PaymentStatus.REFUNDED);
  });
});
