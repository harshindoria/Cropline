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
import { cancelOrder, getOrderById, rejectOrder } from '../src/controller/order.controller';
import { initiateOrderPayment } from '../src/controller/payment.controller';
import { submitReview } from '../src/controller/review.controller';
import { fetchRazorpayOrderPayments, fetchRazorpayRefunds, issueRazorpayRefund } from '../src/services/payment.service';
import {
  applyDispute,
  applyFailedRefund,
  applyProcessedRefund,
  markPaymentFailed,
  markPaymentSucceeded,
  reconcileUnconfirmedPayments,
  refundPayment,
} from '../src/services/paymentRecord.service';
import { expireStaleOrders } from '../src/services/orderCancellation.service';
import { makeCatalog, makeUser, resetDatabase } from './helpers';

vi.mock('../src/services/payment.service', () => ({
  issueRazorpayRefund: vi.fn(),
  fetchRazorpayOrderPayments: vi.fn(),
  fetchRazorpayRefunds: vi.fn(),
}));
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
  // By default Razorpay has no refunds yet for any payment.
  vi.mocked(fetchRazorpayRefunds).mockReset().mockResolvedValue([]);
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

    expect(await refundPayment(record.id, 'Order cancelled')).toBe('REFUNDED');
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

  it('saves the payment even if its refund fails, so a retry can refund it', async () => {
    const record = await makeRecord({}, OrderStatus.CANCELLED);
    vi.mocked(issueRazorpayRefund).mockRejectedValueOnce(new Error('Razorpay down'));

    await expect(markPaymentSucceeded(record.providerOrderId!, 'pay_late')).rejects.toThrow('Razorpay down');
    // The money arrived, so that is recorded. It is held on a cancelled order until the refund works.
    expect((await load(record.id)).status).toBe(PaymentStatus.SUCCESS);

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

    // The payment stays held on the cancelled order, where the reconciliation job keeps retrying it.
    expect((await load(record.id)).status).toBe(PaymentStatus.SUCCESS);
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

describe('cancelling a paid order', () => {
  const later = () => new Date(Date.now() + 10 * 60 * 1000);

  // A PENDING order of 10 kg whose ₹120 online payment has been captured. Of the crop's 200 kg, this
  // order reserved 10 and other orders 40, so cancelling it should bring the crop to 160. Returning
  // the stock twice would give 170, which the database's stock rule would not catch.
  const paidOrder = async () => {
    const farmer = await makeUser();
    const buyer = await makeUser();
    const order = await makeOrder(farmer.id, buyer.id, OrderStatus.PENDING);
    await prisma.crop.update({ where: { id: order.cropId }, data: { quantityRemainingKg: 150 } });
    const record = await prisma.paymentRecord.create({
      data: {
        orderId: order.id, provider: 'RAZORPAY', providerOrderId: `order_${order.id}`,
        providerPaymentId: `pay_${order.id}`, amount: 120, status: PaymentStatus.SUCCESS,
      },
    });
    return { farmer, buyer, order, record };
  };
  const stockOf = async (cropId: string) =>
    Number((await prisma.crop.findUniqueOrThrow({ where: { id: cropId } })).quantityRemainingKg);
  const statusOf = async (recordId: string) => (await prisma.paymentRecord.findUniqueOrThrow({ where: { id: recordId } })).status;

  it('still cancels the order when Razorpay refuses the refund, and the job refunds it later', async () => {
    const { buyer, order, record } = await paidOrder();
    vi.mocked(issueRazorpayRefund).mockRejectedValueOnce(new Error('Failed to issue refund via Razorpay: invalid request sent'));

    const result = await call({ params: { id: order.id }, user: buyer }, cancelOrder);

    expect(result.status).toBe(200);
    expect(result.body.message).toContain('will keep retrying');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(OrderStatus.CANCELLED);
    expect(await stockOf(order.cropId)).toBe(160);
    expect(await statusOf(record.id)).toBe(PaymentStatus.SUCCESS);

    vi.mocked(issueRazorpayRefund).mockResolvedValue({ id: 'rfnd_later', amount: 12000, status: 'pending' } as any);
    expect(await reconcileUnconfirmedPayments(later())).toMatchObject({ refunded: 1, errors: 0 });
    expect(await statusOf(record.id)).toBe(PaymentStatus.REFUNDED);
  });

  it('saves a refund Razorpay already made instead of asking for a second one', async () => {
    const { record } = await paidOrder();
    // An earlier attempt refunded it, but crashed before saving that.
    vi.mocked(fetchRazorpayRefunds).mockResolvedValue([{ id: 'rfnd_lost', amount: 12000, status: 'processed' }]);

    expect(await refundPayment(record.id, 'Order cancelled')).toBe('REFUNDED');

    expect(issueRazorpayRefund).not.toHaveBeenCalled();
    const refund = await prisma.refund.findUniqueOrThrow({ where: { providerRefundId: 'rfnd_lost' } });
    expect(refund.status).toBe('PROCESSED');
    expect(await statusOf(record.id)).toBe(PaymentStatus.REFUNDED);
  });

  it('treats a refund refused because someone else just refunded it as done, without alerting', async () => {
    const { record } = await paidOrder();
    await makeUser({ roles: [Role.ADMIN], activeRole: Role.ADMIN });
    vi.mocked(fetchRazorpayRefunds)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'rfnd_other', amount: 12000, status: 'pending' }]);
    vi.mocked(issueRazorpayRefund).mockRejectedValueOnce(new Error('Failed to issue refund via Razorpay: fully refunded'));

    expect(await refundPayment(record.id, 'Order cancelled')).toBe('REFUNDED');

    expect(await statusOf(record.id)).toBe(PaymentStatus.REFUNDED);
    expect(await prisma.notification.count({ where: { title: 'Refund failed: buyer money is held' } })).toBe(0);
  });

  it('returns the stock and refunds once when the buyer cancels while the farmer rejects', async () => {
    const { farmer, buyer, order, record } = await paidOrder();
    vi.mocked(issueRazorpayRefund).mockResolvedValue({ id: 'rfnd_once', amount: 12000, status: 'pending' } as any);

    const results = await Promise.all([
      call({ params: { id: order.id }, user: buyer }, cancelOrder),
      call({ params: { id: order.id }, user: farmer, body: {} }, rejectOrder),
    ]);

    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await stockOf(order.cropId)).toBe(160);
    expect(issueRazorpayRefund).toHaveBeenCalledTimes(1);
    expect(await statusOf(record.id)).toBe(PaymentStatus.REFUNDED);
  });
});

describe('refund progress', () => {
  const later = () => new Date(Date.now() + 10 * 60 * 1000);
  const paidCancelled = async () => {
    const order = await makeOrder((await makeUser()).id, (await makeUser()).id, OrderStatus.CANCELLED);
    return prisma.paymentRecord.create({
      data: {
        orderId: order.id, provider: 'RAZORPAY', providerOrderId: `order_${order.id}`,
        providerPaymentId: 'pay_1', amount: 120, status: PaymentStatus.SUCCESS,
      },
    });
  };
  const load = (id: string) => prisma.paymentRecord.findUniqueOrThrow({ where: { id } });

  it('shows a refund as on its way until Razorpay completes it', async () => {
    const record = await paidCancelled();
    vi.mocked(issueRazorpayRefund).mockResolvedValue({ id: 'rfnd_1', amount: 12000, status: 'pending' } as any);

    await refundPayment(record.id, 'Order cancelled');
    const issued = await load(record.id);
    expect(issued.status).toBe(PaymentStatus.REFUNDED);
    expect(issued.refundedAt).toBeNull();

    await applyProcessedRefund({ id: 'rfnd_1', payment_id: 'pay_1', amount: 12000 });
    expect((await load(record.id)).refundedAt).not.toBeNull();
  });

  it('holds the payment again when Razorpay reports the refund failed, alerts admins, and refunds it afresh', async () => {
    const admin = await makeUser({ roles: [Role.ADMIN], activeRole: Role.ADMIN });
    const record = await paidCancelled();
    vi.mocked(issueRazorpayRefund).mockResolvedValue({ id: 'rfnd_1', amount: 12000, status: 'pending' } as any);
    await refundPayment(record.id, 'Order cancelled');

    await applyFailedRefund({ id: 'rfnd_1', payment_id: 'pay_1', amount: 12000 });

    expect((await load(record.id)).status).toBe(PaymentStatus.SUCCESS);
    expect((await prisma.refund.findUniqueOrThrow({ where: { providerRefundId: 'rfnd_1' } })).status).toBe('FAILED');
    expect(await prisma.notification.count({ where: { userId: admin.id, title: 'Refund failed: buyer money is held' } })).toBe(1);

    // Razorpay now lists the failed refund. The job must not mistake it for a refund that worked.
    vi.mocked(fetchRazorpayRefunds).mockResolvedValue([{ id: 'rfnd_1', amount: 12000, status: 'failed' }]);
    vi.mocked(issueRazorpayRefund).mockResolvedValue({ id: 'rfnd_2', amount: 12000, status: 'pending' } as any);
    expect(await reconcileUnconfirmedPayments(later())).toMatchObject({ refunded: 1 });

    expect((await load(record.id)).status).toBe(PaymentStatus.REFUNDED);
    expect(await prisma.refund.count({ where: { paymentRecordId: record.id } })).toBe(2);
  });

  it('completes a refund whose webhook was missed', async () => {
    const record = await paidCancelled();
    vi.mocked(issueRazorpayRefund).mockResolvedValue({ id: 'rfnd_1', amount: 12000, status: 'pending' } as any);
    await refundPayment(record.id, 'Order cancelled');

    vi.mocked(fetchRazorpayRefunds).mockResolvedValue([{ id: 'rfnd_1', amount: 12000, status: 'processed' }]);
    expect(await reconcileUnconfirmedPayments(later())).toMatchObject({ refundsUpdated: 1 });

    const after = await load(record.id);
    expect(after.status).toBe(PaymentStatus.REFUNDED);
    expect(after.refundedAt).not.toBeNull();
  });
});

describe('orders nobody acted on', () => {
  const minutesLater = (minutes: number) => new Date(Date.now() + minutes * 60 * 1000);

  // A PENDING online order of 10 kg. Its crop has 150 kg left, so cancelling it gives 160.
  const pendingOrder = async (payment: PaymentStatus | null, paymentType: PaymentType = PaymentType.ONLINE) => {
    const farmer = await makeUser();
    const buyer = await makeUser();
    const order = await makeOrder(farmer.id, buyer.id, OrderStatus.PENDING);
    await prisma.crop.update({ where: { id: order.cropId }, data: { quantityRemainingKg: 150 } });
    await prisma.order.update({ where: { id: order.id }, data: { paymentType } });
    if (payment) {
      await prisma.paymentRecord.create({
        data: {
          orderId: order.id, provider: 'RAZORPAY', providerOrderId: `order_${order.id}`, amount: 120, status: payment,
          providerPaymentId: payment === PaymentStatus.SUCCESS ? `pay_${order.id}` : null,
        },
      });
    }
    return { farmer, buyer, order };
  };
  const orderStatus = async (id: string) => (await prisma.order.findUniqueOrThrow({ where: { id } })).status;
  const stockOf = async (cropId: string) =>
    Number((await prisma.crop.findUniqueOrThrow({ where: { id: cropId } })).quantityRemainingKg);

  it('cancels an online order left unpaid for 30 minutes, returns its stock and tells the buyer', async () => {
    const { buyer, order } = await pendingOrder(PaymentStatus.PENDING);

    expect(await expireStaleOrders(minutesLater(29))).toMatchObject({ unpaid: 0 });
    expect(await orderStatus(order.id)).toBe(OrderStatus.PENDING);

    expect(await expireStaleOrders(minutesLater(31))).toMatchObject({ unpaid: 1 });
    expect(await orderStatus(order.id)).toBe(OrderStatus.CANCELLED);
    expect(await stockOf(order.cropId)).toBe(160);
    expect(await prisma.notification.count({ where: { userId: buyer.id, title: 'Order cancelled: not paid ⏰' } })).toBe(1);
    expect(issueRazorpayRefund).not.toHaveBeenCalled();
  });

  it('leaves a paid order and a cash order waiting for the farmer', async () => {
    const paid = await pendingOrder(PaymentStatus.SUCCESS);
    const cash = await pendingOrder(PaymentStatus.PENDING, PaymentType.CASH);

    expect(await expireStaleOrders(minutesLater(31))).toMatchObject({ unpaid: 0, unanswered: 0 });

    expect(await orderStatus(paid.order.id)).toBe(OrderStatus.PENDING);
    expect(await orderStatus(cash.order.id)).toBe(OrderStatus.PENDING);
  });

  it('cancels and refunds a paid order the farmer never answered, and tells both sides', async () => {
    const { farmer, buyer, order } = await pendingOrder(PaymentStatus.SUCCESS);
    await prisma.order.update({ where: { id: order.id }, data: { farmerResponseDeadline: minutesLater(60) } });
    vi.mocked(issueRazorpayRefund).mockResolvedValue({ id: 'rfnd_late', amount: 12000, status: 'pending' } as any);

    expect(await expireStaleOrders(minutesLater(59))).toMatchObject({ unanswered: 0 });
    expect(await expireStaleOrders(minutesLater(61))).toMatchObject({ unanswered: 1 });

    expect(await orderStatus(order.id)).toBe(OrderStatus.CANCELLED);
    expect(await stockOf(order.cropId)).toBe(160);
    expect(issueRazorpayRefund).toHaveBeenCalledTimes(1);
    const record = await prisma.paymentRecord.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(record.status).toBe(PaymentStatus.REFUNDED);
    expect(await prisma.notification.count({ where: { userId: buyer.id, title: 'Order cancelled: farmer did not respond' } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: farmer.id, title: 'Order cancelled: no response ⏰' } })).toBe(1);
  });

  it('does not cancel an order twice when the job runs again', async () => {
    const { order } = await pendingOrder(PaymentStatus.PENDING);

    await expireStaleOrders(minutesLater(31));
    expect(await expireStaleOrders(minutesLater(40))).toMatchObject({ unpaid: 0, unanswered: 0, errors: 0 });

    expect(await stockOf(order.cropId)).toBe(160);
  });
});

describe('paying online for an order that is already paid', () => {
  // A cash order the delivery partner has delivered and collected cash for.
  const cashPaidOrder = async () => {
    const buyer = await makeUser();
    const order = await makeOrder((await makeUser()).id, buyer.id, OrderStatus.DELIVERED);
    const record = await prisma.paymentRecord.create({
      data: { orderId: order.id, provider: 'CASH_COD', providerOrderId: `order_${order.id}`, amount: 120, status: PaymentStatus.SUCCESS },
    });
    return { buyer, order, record };
  };

  it('refunds the online payment, keeps the order paid, and tells the buyer once', async () => {
    const { buyer, record } = await cashPaidOrder();
    vi.mocked(issueRazorpayRefund).mockResolvedValue({ id: 'rfnd_extra', amount: 12000, status: 'pending' } as any);

    // The buyer's open payment window completed just after they paid cash.
    expect(await markPaymentSucceeded(record.providerOrderId!, 'pay_extra')).toBe('REFUNDED_DUPLICATE');

    // The webhook reports the same payment again. Razorpay now has the refund.
    vi.mocked(fetchRazorpayRefunds).mockResolvedValue([{ id: 'rfnd_extra', amount: 12000, status: 'pending' }]);
    expect(await markPaymentSucceeded(record.providerOrderId!, 'pay_extra')).toBe('REFUNDED_DUPLICATE');

    expect(issueRazorpayRefund).toHaveBeenCalledTimes(1);
    expect(issueRazorpayRefund).toHaveBeenCalledWith('pay_extra', undefined, expect.anything());
    const after = await prisma.paymentRecord.findUniqueOrThrow({ where: { id: record.id } });
    expect(after.status).toBe(PaymentStatus.SUCCESS);
    expect(after.providerPaymentId).toBeNull();
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { providerPaymentId: 'pay_extra' } });
    expect(attempt.status).toBe(PaymentStatus.REFUNDED);
    expect(await prisma.notification.count({ where: { userId: buyer.id, title: 'Extra payment refunded' } })).toBe(1);
  });

  it('lets a buyer start an online payment for a cash order that is out for delivery', async () => {
    const buyer = await makeUser();
    const order = await makeOrder((await makeUser()).id, buyer.id, OrderStatus.IN_DELIVERY);
    await prisma.order.update({ where: { id: order.id }, data: { paymentType: PaymentType.CASH } });
    await prisma.paymentRecord.create({
      data: { orderId: order.id, provider: 'CASH_COD', providerOrderId: `order_${order.id}`, amount: 120 },
    });

    const result = await call({ params: { orderId: order.id }, user: buyer }, initiateOrderPayment);

    expect(result.status).toBe(200);
  });
});

describe('payment disputes', () => {
  const paidDeliveredOrder = async () => {
    const order = await makeOrder((await makeUser()).id, (await makeUser()).id, OrderStatus.DELIVERED);
    const record = await prisma.paymentRecord.create({
      data: {
        orderId: order.id, provider: 'RAZORPAY', providerOrderId: `order_${order.id}`,
        providerPaymentId: 'pay_1', amount: 120, status: PaymentStatus.SUCCESS,
      },
    });
    return { order, record };
  };
  const dispute = { id: 'disp_1', payment_id: 'pay_1', amount: 12000, reason_code: 'goods_not_received' };
  const load = (id: string) => prisma.paymentRecord.findUniqueOrThrow({ where: { id } });

  it('marks the payment disputed, leaves the order status alone, and alerts admins once', async () => {
    const admin = await makeUser({ roles: [Role.ADMIN], activeRole: Role.ADMIN });
    const { order, record } = await paidDeliveredOrder();

    await applyDispute('created', dispute);
    await applyDispute('created', dispute);

    expect((await load(record.id)).disputedAt).not.toBeNull();
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(OrderStatus.DELIVERED);
    const alerts = await prisma.notification.findMany({ where: { userId: admin.id } });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].alertLevel).toBe('CRITICAL');
    expect(alerts[0].body).toContain('goods_not_received');
  });

  it('clears the dispute when it is won, and keeps it when it is lost', async () => {
    const admin = await makeUser({ roles: [Role.ADMIN], activeRole: Role.ADMIN });
    const { record } = await paidDeliveredOrder();

    await applyDispute('created', dispute);
    await applyDispute('won', dispute);
    expect((await load(record.id)).disputedAt).toBeNull();

    await applyDispute('created', { ...dispute, id: 'disp_2' });
    await applyDispute('lost', { ...dispute, id: 'disp_2' });
    expect((await load(record.id)).disputedAt).not.toBeNull();
    expect(await prisma.notification.count({ where: { userId: admin.id, title: 'Payment dispute lost' } })).toBe(1);
  });
});
