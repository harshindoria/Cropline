import {
  NotificationAlertLevel,
  OrderStatus,
  PaymentStatus,
  Prisma,
  RefundStatus,
  Role,
  RoleAccessStatus,
} from '@prisma/client';
import prisma from '../config/db';
import { issueRazorpayRefund } from './payment.service';

type Tx = Prisma.TransactionClient;

const saveAttempt = (
  tx: Tx,
  record: { id: string; amount: Prisma.Decimal },
  providerPaymentId: string,
  status: PaymentStatus,
  failureReason?: string,
) =>
  tx.paymentAttempt.upsert({
    where: { providerPaymentId },
    create: { paymentRecordId: record.id, providerPaymentId, status, amount: record.amount, failureReason },
    update: { status, failureReason },
  });

export type PaymentOutcome = 'NOT_FOUND' | 'PAID' | 'REFUNDED_CANCELLED_ORDER';

// Checkout and the webhook both report the same payment, so this must be safe to run twice.
//
// A buyer can still be on the Razorpay screen when their order is cancelled, so money can arrive
// for a cancelled order. That money is refunded here, because nothing else would ever return it.
export const markPaymentSucceeded = (providerOrderId: string, providerPaymentId: string): Promise<PaymentOutcome> =>
  prisma.$transaction(async (tx) => {
    const record = await tx.paymentRecord.findUnique({ where: { providerOrderId } });
    if (!record) return 'NOT_FOUND';

    // Locks the order until this transaction ends. A cancellation that is already running finishes
    // first and we see CANCELLED; one that starts later waits for us. Checkout and the webhook for
    // the same payment also queue here, so only one of them can issue the refund.
    const [order] = await tx.$queryRaw<{ status: OrderStatus; buyerId: string }[]>`
      SELECT status, "buyerId" FROM "Order" WHERE id = ${record.orderId} FOR UPDATE`;

    await saveAttempt(tx, record, providerPaymentId, PaymentStatus.SUCCESS);
    await tx.paymentRecord.updateMany({
      where: { id: record.id, status: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] } },
      data: { status: PaymentStatus.SUCCESS, providerPaymentId, capturedAt: new Date() },
    });

    if (order?.status !== OrderStatus.CANCELLED) return 'PAID';

    // Refund only a payment that is still held. Once refunded it is REFUNDED, so a repeat call does nothing.
    const current = await tx.paymentRecord.findUniqueOrThrow({ where: { id: record.id } });
    if (current.status === PaymentStatus.SUCCESS) {
      await refundFullPayment(tx, current, 'Payment received after the order was cancelled');
      await tx.notification.create({
        data: {
          userId: order.buyerId,
          alertLevel: 'WARNING',
          title: 'Payment refunded',
          body: `Your order was cancelled before your payment of ₹${current.amount} arrived, so we have refunded it in full.`,
          data: { orderId: record.orderId },
        },
      });
    }
    return 'REFUNDED_CANCELLED_ORDER';
  });

// A buyer can fail and then retry, so a late failure must not undo a payment that succeeded.
export const markPaymentFailed = (providerOrderId: string, providerPaymentId: string, failureReason?: string) =>
  prisma.$transaction(async (tx) => {
    const record = await tx.paymentRecord.findUnique({ where: { providerOrderId } });
    if (!record) return;

    await saveAttempt(tx, record, providerPaymentId, PaymentStatus.FAILED, failureReason);
    await tx.paymentRecord.updateMany({
      where: { id: record.id, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.FAILED },
    });
  });

const paiseToRupees = (paise: number | string) => new Prisma.Decimal(paise).div(100);

/** Refunds the whole payment through Razorpay and records it. The webhook later confirms the same refund. */
export const refundFullPayment = async (
  tx: Tx,
  record: { id: string; providerPaymentId: string | null },
  reason: string,
): Promise<void> => {
  if (!record.providerPaymentId) throw new Error(`Payment ${record.id} has no Razorpay payment to refund`);

  let refund;
  try {
    refund = await issueRazorpayRefund(record.providerPaymentId, undefined, { reason });
  } catch (error) {
    // The caller's transaction is about to roll back, so the alert is written outside it.
    await alertAdminsRefundFailed(record.id, error).catch((alertError) =>
      console.error(`Could not alert admins about the failed refund of payment ${record.id}:`, alertError),
    );
    throw error;
  }
  const now = new Date();
  const processed = refund.status === 'processed';
  const status = processed ? RefundStatus.PROCESSED : RefundStatus.PENDING;
  const processedAt = processed ? now : null;

  await tx.refund.upsert({
    where: { providerRefundId: refund.id },
    create: {
      paymentRecordId: record.id,
      providerRefundId: refund.id,
      amount: paiseToRupees(refund.amount ?? 0),
      status,
      reason,
      processedAt,
    },
    update: { reason },
  });
  await tx.paymentRecord.update({
    where: { id: record.id },
    data: { status: PaymentStatus.REFUNDED, refundedAt: now },
  });
};

type AdminAlert = {
  alertLevel: NotificationAlertLevel;
  title: string;
  body: string;
  data: Prisma.InputJsonObject;
};

const notifyAdmins = async (db: Pick<Tx, 'userRoleAccess' | 'notification'>, alert: AdminAlert) => {
  const admins = await db.userRoleAccess.findMany({
    where: { role: Role.ADMIN, status: RoleAccessStatus.ACTIVE },
    select: { userId: true },
  });
  await db.notification.createMany({ data: admins.map(({ userId }) => ({ userId, ...alert })) });
};

// The farmer and partner were already paid for a delivered order. Taking that back is a business
// decision, so this only tells the admins and leaves every wallet as it is.
const alertAdminsIfDelivered = async (tx: Tx, orderId: string, amount: Prisma.Decimal) => {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } });
  if (order.status !== OrderStatus.DELIVERED && order.status !== OrderStatus.COMPLETED) return;

  await notifyAdmins(tx, {
    alertLevel: NotificationAlertLevel.WARNING,
    title: 'Refund on a delivered order',
    body: `₹${amount} was refunded on delivered order ${orderId}. The farmer and partner earnings were not changed, so please review it.`,
    data: { orderId },
  });
};

/**
 * Tells the admins that Razorpay refused a refund, so a buyer's money is still held. Every caller
 * retries a failed refund (the webhook, the cron, the buyer pressing cancel again), so this sends
 * one alert per payment rather than one per attempt.
 */
const alertAdminsRefundFailed = async (paymentRecordId: string, error: unknown) => {
  const alreadyAlerted = await prisma.notification.findFirst({
    where: { data: { path: ['refundFailedFor'], equals: paymentRecordId } },
    select: { id: true },
  });
  if (alreadyAlerted) return;

  const record = await prisma.paymentRecord.findUniqueOrThrow({
    where: { id: paymentRecordId },
    select: { orderId: true, amount: true },
  });
  const cause = error instanceof Error ? error.message : String(error);
  await notifyAdmins(prisma, {
    alertLevel: NotificationAlertLevel.CRITICAL,
    title: 'Refund failed: buyer money is held',
    body: `Razorpay refused to refund ₹${record.amount} for order ${record.orderId} (${cause}). The buyer's money is still with us. Refund it from the Razorpay dashboard, or fix the cause so the next retry succeeds.`,
    data: { orderId: record.orderId, refundFailedFor: paymentRecordId },
  });
};

/** Records a refund Razorpay has completed. The payment only becomes REFUNDED once all of it has been returned. */
export const applyProcessedRefund = (entity: { id: string; payment_id: string; amount: number }) =>
  prisma.$transaction(async (tx) => {
    const record = await tx.paymentRecord.findUnique({ where: { providerPaymentId: entity.payment_id } });
    if (!record) return;

    const now = new Date();
    const alreadyRecorded = await tx.refund.findUnique({ where: { providerRefundId: entity.id }, select: { id: true } });
    await tx.refund.upsert({
      where: { providerRefundId: entity.id },
      create: {
        paymentRecordId: record.id,
        providerRefundId: entity.id,
        amount: paiseToRupees(entity.amount),
        status: RefundStatus.PROCESSED,
        processedAt: now,
      },
      update: { status: RefundStatus.PROCESSED, processedAt: now },
    });

    const { _sum } = await tx.refund.aggregate({
      where: { paymentRecordId: record.id, status: { not: RefundStatus.FAILED } },
      _sum: { amount: true },
    });
    if (_sum.amount?.gte(record.amount)) {
      await tx.paymentRecord.update({
        where: { id: record.id },
        data: { status: PaymentStatus.REFUNDED, refundedAt: now },
      });
    }

    if (!alreadyRecorded) await alertAdminsIfDelivered(tx, record.orderId, paiseToRupees(entity.amount));
  });
