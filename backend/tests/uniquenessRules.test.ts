import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CropCategory,
  DeliveryJobStatus,
  DeliveryType,
  OrderStatus,
  PaymentStatus,
  PaymentType,
  ReviewTargetType,
  Role,
} from '@prisma/client';
import prisma from '../src/config/db';
import { getOrderById } from '../src/controller/order.controller';
import { initiateOrderPayment } from '../src/controller/payment.controller';
import { submitReview } from '../src/controller/review.controller';
import { fetchRazorpayOrderPayments, issueRazorpayRefund } from '../src/services/payment.service';
import {
  applyProcessedRefund,
  markPaymentFailed,
  markPaymentSucceeded,
  reconcileUnconfirmedPayments,
  refundFullPayment,
} from '../src/services/paymentRecord.service';
import { makeCatalog, makeUser, resetDatabase } from './helpers';

vi.mock('../src/services/payment.service', () => ({ issueRazorpayRefund: vi.fn(), fetchRazorpayOrderPayments: vi.fn() }));
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
  const catalog = await makeCatalog();
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
      deliveryLatitude: 27,
      deliveryLongitude: 75.9,
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
  vi.mocked(fetchRazorpayOrderPayments).mockReset();
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
  const makeRecord = async (
    data: { status?: PaymentStatus; providerPaymentId?: string } = {},
    orderStatus: OrderStatus = OrderStatus.DELIVERED,
  ) => {
    const order = await makeOrder((await makeUser()).id, (await makeUser()).id, orderStatus);
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

  it('refunds a payment that arrives after its order was cancelled, once, and tells the buyer', async () => {
    const record = await makeRecord({}, OrderStatus.CANCELLED);
    vi.mocked(issueRazorpayRefund).mockResolvedValue({ id: 'rfnd_late', amount: 12000, status: 'pending' } as any);

    // Checkout and the webhook both report the same payment.
    expect(await markPaymentSucceeded(record.providerOrderId!, 'pay_late')).toBe('REFUNDED_CANCELLED_ORDER');
    expect(await markPaymentSucceeded(record.providerOrderId!, 'pay_late')).toBe('REFUNDED_CANCELLED_ORDER');

    expect(issueRazorpayRefund).toHaveBeenCalledTimes(1);
    expect(issueRazorpayRefund).toHaveBeenCalledWith('pay_late', undefined, expect.anything());
    expect((await load(record.id)).status).toBe(PaymentStatus.REFUNDED);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: record.orderId } });
    const notes = await prisma.notification.findMany({ where: { userId: order.buyerId, title: 'Payment refunded' } });
    expect(notes).toHaveLength(1);
  });

  it('does not refund a payment for an order that is still open', async () => {
    const record = await makeRecord({}, OrderStatus.PENDING);

    expect(await markPaymentSucceeded(record.providerOrderId!, 'pay_ok')).toBe('PAID');

    expect(issueRazorpayRefund).not.toHaveBeenCalled();
    expect((await load(record.id)).status).toBe(PaymentStatus.SUCCESS);
  });

  it('keeps the payment unconfirmed if the refund fails, so the webhook retry can try again', async () => {
    const record = await makeRecord({}, OrderStatus.CANCELLED);
    vi.mocked(issueRazorpayRefund).mockRejectedValueOnce(new Error('Razorpay down'));

    await expect(markPaymentSucceeded(record.providerOrderId!, 'pay_late')).rejects.toThrow('Razorpay down');
    expect((await load(record.id)).status).toBe(PaymentStatus.PENDING);

    vi.mocked(issueRazorpayRefund).mockResolvedValue({ id: 'rfnd_retry', amount: 12000, status: 'pending' } as any);
    expect(await markPaymentSucceeded(record.providerOrderId!, 'pay_late')).toBe('REFUNDED_CANCELLED_ORDER');
    expect((await load(record.id)).status).toBe(PaymentStatus.REFUNDED);
  });

  it('alerts each admin once when Razorpay keeps refusing a refund, however often it is retried', async () => {
    const admins = [
      await makeUser({ roles: [Role.ADMIN], activeRole: Role.ADMIN }),
      await makeUser({ roles: [Role.ADMIN], activeRole: Role.ADMIN }),
    ];
    const record = await makeRecord({}, OrderStatus.CANCELLED);
    vi.mocked(issueRazorpayRefund).mockRejectedValue(new Error('Failed to issue refund via Razorpay: invalid request sent'));

    // The webhook retries, and so would the cron and the buyer.
    await expect(markPaymentSucceeded(record.providerOrderId!, 'pay_late')).rejects.toThrow('invalid request sent');
    await expect(markPaymentSucceeded(record.providerOrderId!, 'pay_late')).rejects.toThrow('invalid request sent');

    const alerts = await prisma.notification.findMany({ where: { title: 'Refund failed: buyer money is held' } });
    expect(alerts.map((a) => a.userId).sort()).toEqual(admins.map((a) => a.id).sort());
    expect(alerts[0].alertLevel).toBe('CRITICAL');
    expect(alerts[0].body).toContain('₹120');
    expect(alerts[0].body).toContain('invalid request sent');
    expect(alerts[0].data).toEqual({ orderId: record.orderId, refundFailedFor: record.id });

    // The alert survives, but the payment itself stays unconfirmed so a retry can still refund it.
    expect((await load(record.id)).status).toBe(PaymentStatus.PENDING);
  });

  it('sends no refund alert when the refund works', async () => {
    await makeUser({ roles: [Role.ADMIN], activeRole: Role.ADMIN });
    const record = await makeRecord({}, OrderStatus.CANCELLED);
    vi.mocked(issueRazorpayRefund).mockResolvedValue({ id: 'rfnd_ok', amount: 12000, status: 'pending' } as any);

    await markPaymentSucceeded(record.providerOrderId!, 'pay_late');

    expect(await prisma.notification.count({ where: { title: 'Refund failed: buyer money is held' } })).toBe(0);
  });
});

describe('starting a payment', () => {
  const initiate = async (orderStatus: OrderStatus, paymentStatus: PaymentStatus = PaymentStatus.PENDING) => {
    const buyer = await makeUser();
    const order = await makeOrder((await makeUser()).id, buyer.id, orderStatus);
    await prisma.paymentRecord.create({
      data: { orderId: order.id, provider: 'RAZORPAY', providerOrderId: `order_${order.id}`, amount: 120, status: paymentStatus },
    });
    return call({ params: { orderId: order.id }, user: buyer }, initiateOrderPayment);
  };

  it.each([OrderStatus.CANCELLED, OrderStatus.DELIVERED, OrderStatus.COMPLETED, OrderStatus.DISPUTED])(
    'refuses to take money for a %s order',
    async (status) => {
      const result = await initiate(status);
      expect(result.status).toBe(409);
      expect(result.body.code).toBe('ORDER_CLOSED');
    },
  );

  it('refuses to reuse the Razorpay order of a refunded payment', async () => {
    const result = await initiate(OrderStatus.PENDING, PaymentStatus.REFUNDED);
    expect(result.status).toBe(409);
    expect(result.body.code).toBe('PAYMENT_REFUNDED');
  });

  it('still lets the buyer pay for an open order', async () => {
    const result = await initiate(OrderStatus.PENDING);
    expect(result.status).toBe(200);
    expect(result.body.data.providerOrderId).toMatch(/^order_/);
  });
});

describe('payment reconciliation', () => {
  // The job skips payments younger than 5 minutes, so tests run it as if 10 minutes have passed.
  const later = () => new Date(Date.now() + 10 * 60 * 1000);

  const makeUnconfirmed = async (orderStatus: OrderStatus = OrderStatus.PENDING, status: PaymentStatus = PaymentStatus.PENDING) => {
    const order = await makeOrder((await makeUser()).id, (await makeUser()).id, orderStatus);
    return prisma.paymentRecord.create({
      data: { orderId: order.id, provider: 'RAZORPAY', providerOrderId: `order_${order.id}`, amount: 120, status },
    });
  };
  const load = (id: string) => prisma.paymentRecord.findUniqueOrThrow({ where: { id } });
  const razorpayHas = (byOrder: Record<string, { id: string; status: string; error_description?: string }[]>) =>
    vi.mocked(fetchRazorpayOrderPayments).mockImplementation(async (id) => byOrder[id] ?? []);

  it('confirms a payment Razorpay captured but nobody told us about', async () => {
    const record = await makeUnconfirmed();
    razorpayHas({ [record.providerOrderId!]: [{ id: 'pay_lost', status: 'captured' }] });

    expect(await reconcileUnconfirmedPayments(later())).toMatchObject({ checked: 1, confirmed: 1 });

    const after = await load(record.id);
    expect(after.status).toBe(PaymentStatus.SUCCESS);
    expect(after.providerPaymentId).toBe('pay_lost');
  });

  it('refunds a lost payment whose order was cancelled', async () => {
    const record = await makeUnconfirmed(OrderStatus.CANCELLED);
    razorpayHas({ [record.providerOrderId!]: [{ id: 'pay_lost', status: 'captured' }] });
    vi.mocked(issueRazorpayRefund).mockResolvedValue({ id: 'rfnd_lost', amount: 12000, status: 'pending' } as any);

    await reconcileUnconfirmedPayments(later());

    expect(issueRazorpayRefund).toHaveBeenCalledWith('pay_lost', undefined, expect.anything());
    expect((await load(record.id)).status).toBe(PaymentStatus.REFUNDED);
  });

  it('picks a captured payment over earlier failed attempts', async () => {
    const record = await makeUnconfirmed(OrderStatus.PENDING, PaymentStatus.FAILED);
    razorpayHas({
      [record.providerOrderId!]: [
        { id: 'pay_failed', status: 'failed', error_description: 'Card declined' },
        { id: 'pay_ok', status: 'captured' },
      ],
    });

    await reconcileUnconfirmedPayments(later());

    expect((await load(record.id)).status).toBe(PaymentStatus.SUCCESS);
  });

  it('records failed attempts when nothing was captured', async () => {
    const record = await makeUnconfirmed();
    razorpayHas({ [record.providerOrderId!]: [{ id: 'pay_failed', status: 'failed', error_description: 'Card declined' }] });

    expect(await reconcileUnconfirmedPayments(later())).toMatchObject({ checked: 1, failed: 1 });

    expect((await load(record.id)).status).toBe(PaymentStatus.FAILED);
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { providerPaymentId: 'pay_failed' } });
    expect(attempt.failureReason).toBe('Card declined');
  });

  it('leaves an abandoned checkout pending', async () => {
    const record = await makeUnconfirmed();
    razorpayHas({});

    await reconcileUnconfirmedPayments(later());

    expect((await load(record.id)).status).toBe(PaymentStatus.PENDING);
  });

  it('leaves fresh, confirmed and too-old payments to others', async () => {
    const fresh = await makeUnconfirmed();
    const paid = await makeUnconfirmed(OrderStatus.PENDING, PaymentStatus.SUCCESS);
    razorpayHas({});

    // Fresh: checked as of now, so it is under 5 minutes old.
    await reconcileUnconfirmedPayments(new Date());
    // Too old: checked as of 4 days later.
    await reconcileUnconfirmedPayments(new Date(Date.now() + 4 * 24 * 60 * 60 * 1000));

    expect(fetchRazorpayOrderPayments).not.toHaveBeenCalled();
    expect((await load(fresh.id)).status).toBe(PaymentStatus.PENDING);
    expect((await load(paid.id)).status).toBe(PaymentStatus.SUCCESS);
  });

  it('keeps going when one payment cannot be checked', async () => {
    const broken = await makeUnconfirmed();
    const fine = await makeUnconfirmed();
    vi.mocked(fetchRazorpayOrderPayments).mockImplementation(async (id) => {
      if (id === broken.providerOrderId) throw new Error('Razorpay timeout');
      return [{ id: 'pay_fine', status: 'captured' }];
    });

    expect(await reconcileUnconfirmedPayments(later())).toMatchObject({ checked: 1, confirmed: 1, errors: 1 });

    expect((await load(broken.id)).status).toBe(PaymentStatus.PENDING);
    expect((await load(fine.id)).status).toBe(PaymentStatus.SUCCESS);
  });
});
