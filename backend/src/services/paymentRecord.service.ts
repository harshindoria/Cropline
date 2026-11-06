import { OrderStatus, PaymentStatus, Prisma, RefundStatus, Role, RoleAccessStatus } from '@prisma/client';
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

// Checkout and the webhook both report the same payment, so this must be safe to run twice.
export const markPaymentSucceeded = (providerOrderId: string, providerPaymentId: string) =>
  prisma.$transaction(async (tx) => {
    const record = await tx.paymentRecord.findUnique({ where: { providerOrderId } });
    if (!record) return;

    await saveAttempt(tx, record, providerPaymentId, PaymentStatus.SUCCESS);
    await tx.paymentRecord.updateMany({
      where: { id: record.id, status: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] } },
      data: { status: PaymentStatus.SUCCESS, providerPaymentId, capturedAt: new Date() },
    });
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

  const refund = await issueRazorpayRefund(record.providerPaymentId, undefined, { reason });
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

// The farmer and partner were already paid for a delivered order. Taking that back is a business
// decision, so this only tells the admins and leaves every wallet as it is.
const alertAdminsIfDelivered = async (tx: Tx, orderId: string, amount: Prisma.Decimal) => {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } });
  if (order.status !== OrderStatus.DELIVERED && order.status !== OrderStatus.COMPLETED) return;

  const admins = await tx.userRoleAccess.findMany({
    where: { role: Role.ADMIN, status: RoleAccessStatus.ACTIVE },
    select: { userId: true },
  });
  await tx.notification.createMany({
    data: admins.map(({ userId }) => ({
      userId,
      alertLevel: 'WARNING' as const,
      title: 'Refund on a delivered order',
      body: `₹${amount} was refunded on delivered order ${orderId}. The farmer and partner earnings were not changed, so please review it.`,
      data: { orderId },
    })),
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
