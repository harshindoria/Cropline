import { OrderStatus, PaymentStatus, PaymentType, Prisma } from '@prisma/client';
import prisma from '../config/db';
import { refundOrderPayment } from './paymentRecord.service';

type Tx = Prisma.TransactionClient;

/**
 * Cancels an order only if it is still in one of `from`, and only then returns its reserved stock.
 * Returns false if the order has already moved on, for example because the buyer cancelled while
 * the farmer was rejecting it. Checking the status and changing it in one statement means two
 * cancellations at once can't both return the stock.
 *
 * It does not refund. Call refundOrderPayment after the transaction commits, because a Razorpay
 * refund can't be rolled back with it.
 */
export const claimCancellation = async (
  tx: Tx,
  order: { id: string; cropId: string; quantityKg: Prisma.Decimal },
  from: OrderStatus[],
  reason: string,
): Promise<boolean> => {
  const claimed = await tx.order.updateMany({
    where: { id: order.id, status: { in: from } },
    data: { status: OrderStatus.CANCELLED, cancellationReason: reason },
  });
  if (claimed.count !== 1) return false;

  await tx.crop.update({
    where: { id: order.cropId },
    data: { quantityRemainingKg: { increment: order.quantityKg } },
  });
  return true;
};

/** What to tell the person who cancelled, depending on how the refund went. */
export const refundMessage = (outcome: string, cancelled: string): string => {
  if (outcome === 'REFUNDED') return `${cancelled} Your full refund has been started.`;
  if (outcome === 'REFUND_FAILED') {
    return `${cancelled} The refund could not be started yet. We will keep retrying it automatically.`;
  }
  return `${cancelled} Stock has been restored.`;
};

/** How long a farmer has to accept or reject an order before it is cancelled for them. */
export const FARMER_RESPONSE_MS = 6 * 60 * 60 * 1000;

/**
 * How long an online order may stay unpaid. The farmer can't see it and its stock is reserved, so
 * it is cancelled quickly rather than holding stock for hours. The buyer can pay from the order
 * page until then.
 */
export const UNPAID_ORDER_MS = 30 * 60 * 1000;

const expire = async (
  order: { id: string; cropId: string; quantityKg: Prisma.Decimal; buyerId: string; farmerId: string },
  reason: string,
  buyerNote: { title: string; body: string },
  tellFarmer: boolean,
): Promise<boolean> => {
  const claimed = await prisma.$transaction(async (tx) => {
    if (!(await claimCancellation(tx, order, [OrderStatus.PENDING], reason))) return false;
    await tx.notification.create({ data: { userId: order.buyerId, ...buyerNote, data: { orderId: order.id } } });
    if (tellFarmer) {
      await tx.notification.create({
        data: {
          userId: order.farmerId,
          title: 'Order cancelled: no response ⏰',
          body: 'You did not accept or reject an order in time, so it was cancelled and its stock was returned.',
          data: { orderId: order.id },
        },
      });
    }
    return true;
  });
  // After the cancellation is saved. A payment that was captured meanwhile is refunded here.
  if (claimed) await refundOrderPayment(order.id, reason);
  return claimed;
};

/**
 * Cancels orders nobody acted on in time: online orders left unpaid, and orders the farmer never
 * answered. Run from the cron job, after payment reconciliation, so an order that was really paid
 * is confirmed before this looks at it. Each order is handled on its own.
 */
export const expireStaleOrders = async (now = new Date()) => {
  const summary = { unpaid: 0, unanswered: 0, errors: 0 };
  const select = { id: true, cropId: true, quantityKg: true, buyerId: true, farmerId: true };

  const unpaid = await prisma.order.findMany({
    where: {
      status: OrderStatus.PENDING,
      paymentType: PaymentType.ONLINE,
      createdAt: { lte: new Date(now.getTime() - UNPAID_ORDER_MS) },
      OR: [
        { paymentRecord: null },
        { paymentRecord: { status: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] } } },
      ],
    },
    select,
  });
  for (const order of unpaid) {
    try {
      const done = await expire(
        order,
        'Payment was not completed in time',
        {
          title: 'Order cancelled: not paid ⏰',
          body: 'Your order was cancelled because it was not paid within 30 minutes. If any money was taken, it will be refunded automatically.',
        },
        false,
      );
      if (done) summary.unpaid += 1;
    } catch (error) {
      summary.errors += 1;
      console.error(`[CRON] Could not expire unpaid order ${order.id}:`, error);
    }
  }

  const unanswered = await prisma.order.findMany({
    where: { status: OrderStatus.PENDING, farmerResponseDeadline: { lte: now } },
    select,
  });
  for (const order of unanswered) {
    try {
      const done = await expire(
        order,
        'Auto-rejected: the farmer did not respond in time',
        {
          title: 'Order cancelled: farmer did not respond',
          body: 'The farmer did not respond to your order in time, so it was cancelled. If you paid online, your payment will be refunded in full.',
        },
        true,
      );
      if (done) summary.unanswered += 1;
    } catch (error) {
      summary.errors += 1;
      console.error(`[CRON] Could not auto-reject order ${order.id}:`, error);
    }
  }
  return summary;
};
