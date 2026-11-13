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
import {
  fetchRazorpayOrderPayments,
  fetchRazorpayRefunds,
  issueRazorpayRefund,
  RazorpayRefund,
} from './payment.service';

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

export type PaymentOutcome = 'NOT_FOUND' | 'PAID' | 'REFUNDED_CANCELLED_ORDER' | 'REFUNDED_DUPLICATE';

// Checkout and the webhook both report the same payment, so this must be safe to run twice.
//
// A buyer can still be on the Razorpay screen when their order is cancelled, so money can arrive
// for a cancelled order. That money is refunded here, because nothing else would ever return it.
// If that refund fails this throws, so the webhook retries, and the reconciliation job also retries it.
export const markPaymentSucceeded = async (providerOrderId: string, providerPaymentId: string): Promise<PaymentOutcome> => {
  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.paymentRecord.findUnique({ where: { providerOrderId } });
    if (!record) return null;

    // Locks the order until this transaction ends. A cancellation that is already running finishes
    // first and we see CANCELLED. One that starts later waits for us, then sees this payment as
    // SUCCESS when it decides whether to refund.
    const [order] = await tx.$queryRaw<{ status: OrderStatus; buyerId: string }[]>`
      SELECT status, "buyerId" FROM "Order" WHERE id = ${record.orderId} FOR UPDATE`;

    await saveAttempt(tx, record, providerPaymentId, PaymentStatus.SUCCESS);
    const marked = await tx.paymentRecord.updateMany({
      where: { id: record.id, status: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] } },
      data: { status: PaymentStatus.SUCCESS, providerPaymentId, capturedAt: new Date() },
    });
    // The order was already paid some other way: in cash at the door, or by an earlier payment.
    // This one is a second payment for the same order.
    const duplicate = marked.count === 0 && record.providerPaymentId !== providerPaymentId;
    return { record, order, duplicate };
  });

  if (!result) return 'NOT_FOUND';
  const { record, order, duplicate } = result;

  if (duplicate) {
    await refundDuplicatePayment(record, providerPaymentId, order?.buyerId);
    return 'REFUNDED_DUPLICATE';
  }
  if (order?.status !== OrderStatus.CANCELLED) return 'PAID';

  // The payment is saved as SUCCESS before the refund is asked for, so a crash in between leaves a
  // paid, cancelled order that the reconciliation job finds and refunds.
  const outcome = await refundPayment(record.id, 'Payment received after the order was cancelled');
  if (outcome === 'REFUNDED') {
    await prisma.notification.create({
      data: {
        userId: order.buyerId,
        alertLevel: 'WARNING',
        title: 'Payment refunded',
        body: `Your order was cancelled before your payment of ₹${record.amount} arrived, so we have refunded it in full.`,
        data: { orderId: record.orderId },
      },
    });
  }
  return 'REFUNDED_CANCELLED_ORDER';
};

/**
 * Returns a second payment for an order that was already paid, for example when the buyer paid cash
 * at the door while an online payment they had started was still going through. The order keeps
 * its first payment. Safe to repeat: a payment Razorpay has already refunded is left alone.
 */
const refundDuplicatePayment = async (
  record: { id: string; orderId: string; amount: Prisma.Decimal },
  providerPaymentId: string,
  buyerId?: string,
) => {
  const alreadyRefunded = (await fetchRazorpayRefunds(providerPaymentId)).some((r) => r.status !== 'failed');
  if (!alreadyRefunded) {
    try {
      await issueRazorpayRefund(providerPaymentId, undefined, { reason: 'Order was already paid' });
    } catch (error) {
      await alertAdminsRefundFailed(record.id, error).catch((alertError) =>
        console.error(`Could not alert admins about duplicate payment ${providerPaymentId}:`, alertError),
      );
      throw error;
    }
  }

  // The attempt is kept, marked as the one that was refunded. The buyer is told when the refund is issued.
  await prisma.paymentAttempt.updateMany({
    where: { providerPaymentId },
    data: { status: PaymentStatus.REFUNDED },
  });
  if (!alreadyRefunded && buyerId) {
    await prisma.notification.create({
      data: {
        userId: buyerId,
        alertLevel: 'WARNING',
        title: 'Extra payment refunded',
        body: `Your order was already paid, so your online payment of ₹${record.amount} has been refunded in full.`,
        data: { orderId: record.orderId },
      },
    });
  }
};

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

const REFUND_STATUS: Record<string, RefundStatus> = {
  processed: RefundStatus.PROCESSED,
  failed: RefundStatus.FAILED,
};

/**
 * Brings a payment's status in line with its refunds.
 *
 * REFUNDED means refunds covering the whole payment have been issued. refundedAt is filled only
 * once Razorpay has completed them, so REFUNDED without refundedAt is a refund still on its way.
 * A refund Razorpay reports as failed no longer counts, which puts the payment back to SUCCESS:
 * the money is held again and has to be refunded again.
 *
 * Returns true only for the call that moved the payment to REFUNDED.
 */
const syncRefundState = async (tx: Tx, paymentRecordId: string, now: Date): Promise<boolean> => {
  // Locked so two refund updates for one payment can't both act on the same old status.
  await tx.$queryRaw`SELECT id FROM "PaymentRecord" WHERE id = ${paymentRecordId} FOR UPDATE`;
  const record = await tx.paymentRecord.findUniqueOrThrow({
    where: { id: paymentRecordId },
    select: { amount: true, status: true, refundedAt: true },
  });
  if (record.status !== PaymentStatus.SUCCESS && record.status !== PaymentStatus.REFUNDED) return false;

  const refunds = await tx.refund.findMany({ where: { paymentRecordId }, select: { amount: true, status: true } });
  const total = (counts: (status: RefundStatus) => boolean) =>
    refunds.filter((r) => counts(r.status)).reduce((sum, r) => sum.plus(r.amount), new Prisma.Decimal(0));
  const issued = total((status) => status !== RefundStatus.FAILED);
  const completed = total((status) => status === RefundStatus.PROCESSED);

  const status = issued.gt(0) && issued.gte(record.amount) ? PaymentStatus.REFUNDED : PaymentStatus.SUCCESS;
  const refundedAt =
    status === PaymentStatus.REFUNDED && completed.gte(record.amount) ? record.refundedAt ?? now : null;

  if (status !== record.status || refundedAt?.getTime() !== record.refundedAt?.getTime()) {
    await tx.paymentRecord.update({ where: { id: paymentRecordId }, data: { status, refundedAt } });
  }
  return record.status === PaymentStatus.SUCCESS && status === PaymentStatus.REFUNDED;
};

/** Saves Razorpay's refunds and updates the payment to match. Returns true only for the call that marked it REFUNDED. */
const saveRefunds = (paymentRecordId: string, refunds: RazorpayRefund[], reason: string) =>
  prisma.$transaction(async (tx) => {
    const now = new Date();
    for (const refund of refunds) {
      const status = REFUND_STATUS[refund.status] ?? RefundStatus.PENDING;
      await tx.refund.upsert({
        where: { providerRefundId: refund.id },
        create: {
          paymentRecordId,
          providerRefundId: refund.id,
          amount: paiseToRupees(refund.amount),
          status,
          reason,
          processedAt: status === RefundStatus.PROCESSED ? now : null,
        },
        // The webhook may have saved it first, without a reason.
        update: { reason },
      });
    }
    return syncRefundState(tx, paymentRecordId, now);
  });

export type RefundOutcome = 'REFUNDED' | 'ALREADY_REFUNDED' | 'NOTHING_TO_REFUND';

/**
 * Refunds a captured payment in full and records it. Call it after the cancellation has been
 * committed, never inside a transaction: a Razorpay refund can't be rolled back, so it must not
 * sit inside work that can be.
 *
 * Safe to call again after any failure. It first asks Razorpay for refunds this payment already
 * has, so a refund that went through but wasn't saved is saved now instead of being asked for
 * twice. If Razorpay refuses, the admins are alerted and this throws; the payment stays SUCCESS on
 * a cancelled order, which the reconciliation job keeps retrying.
 */
export const refundPayment = async (paymentRecordId: string, reason: string): Promise<RefundOutcome> => {
  const record = await prisma.paymentRecord.findUnique({ where: { id: paymentRecordId } });
  if (!record?.providerPaymentId) return 'NOTHING_TO_REFUND';
  if (record.status === PaymentStatus.REFUNDED) return 'ALREADY_REFUNDED';
  if (record.status !== PaymentStatus.SUCCESS) return 'NOTHING_TO_REFUND';

  const paymentId = record.providerPaymentId;
  const existingRefunds = async () => (await fetchRazorpayRefunds(paymentId)).filter((r) => r.status !== 'failed');

  let refunds = await existingRefunds();
  if (refunds.length === 0) {
    try {
      refunds = [await issueRazorpayRefund(paymentId, undefined, { reason }) as RazorpayRefund];
    } catch (error) {
      // Another caller may have refunded it a moment ago, which makes Razorpay refuse this one.
      refunds = await existingRefunds().catch(() => []);
      if (refunds.length === 0) {
        await alertAdminsRefundFailed(record.id, error).catch((alertError) =>
          console.error(`Could not alert admins about the failed refund of payment ${record.id}:`, alertError),
        );
        throw error;
      }
    }
  }

  return (await saveRefunds(record.id, refunds, reason)) ? 'REFUNDED' : 'ALREADY_REFUNDED';
};

/**
 * Refunds an order's payment after the order was cancelled, if it was paid. Never throws: the order
 * is already cancelled, and a refund that fails here has alerted the admins and is retried by the
 * reconciliation job.
 */
export const refundOrderPayment = async (
  orderId: string,
  reason: string,
): Promise<RefundOutcome | 'REFUND_FAILED'> => {
  const record = await prisma.paymentRecord.findUnique({ where: { orderId }, select: { id: true } });
  if (!record) return 'NOTHING_TO_REFUND';
  try {
    return await refundPayment(record.id, reason);
  } catch (error) {
    console.error(`Refund for cancelled order ${orderId} failed and will be retried:`, error);
    return 'REFUND_FAILED';
  }
};

type AdminAlert = {
  alertLevel: NotificationAlertLevel;
  title: string;
  body: string;
  data: Prisma.InputJsonObject;
};

export const notifyAdmins = async (db: Pick<Tx, 'userRoleAccess' | 'notification'>, alert: AdminAlert) => {
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

type RefundEvent = { id: string; payment_id: string; amount: number };

/** Records a refund Razorpay has completed. The payment only becomes REFUNDED once all of it has been returned. */
export const applyProcessedRefund = (entity: RefundEvent) =>
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
    await syncRefundState(tx, record.id, now);

    if (!alreadyRecorded) await alertAdminsIfDelivered(tx, record.orderId, paiseToRupees(entity.amount));
  });

/**
 * Records a refund Razorpay could not complete: the money never reached the buyer. The payment goes
 * back to SUCCESS, so for a cancelled order the reconciliation job issues a fresh refund, and the
 * admins are told in case it keeps failing.
 */
export const applyFailedRefund = async (entity: RefundEvent) => {
  const recordId = await prisma.$transaction(async (tx) => {
    const record = await tx.paymentRecord.findUnique({ where: { providerPaymentId: entity.payment_id } });
    if (!record) return null;

    await tx.refund.upsert({
      where: { providerRefundId: entity.id },
      create: {
        paymentRecordId: record.id,
        providerRefundId: entity.id,
        amount: paiseToRupees(entity.amount),
        status: RefundStatus.FAILED,
      },
      update: { status: RefundStatus.FAILED, processedAt: null },
    });
    await syncRefundState(tx, record.id, new Date());
    return record.id;
  });

  if (recordId) {
    await alertAdminsRefundFailed(recordId, new Error(`Razorpay reported refund ${entity.id} as failed`));
  }
};

// Leave a fresh payment to the checkout and webhook first, so the job doesn't race them.
const RECONCILE_MIN_AGE_MS = 5 * 60 * 1000;
// Razorpay can complete a slow payment some time after checkout says it failed, but not for days.
const RECONCILE_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
// Abandoned checkouts also stay PENDING, so a run is capped. The newest are checked first, because
// a buyer who just paid matters more than a checkout left days ago.
const RECONCILE_BATCH = 200;

/**
 * The backup for a missed confirmation. The browser's /verify call and the webhook can both be
 * lost (a closed tab, a checkout that timed out while the bank page finished, a webhook that
 * can't reach the server), and then a captured payment stays PENDING here forever, and is never
 * refunded if the order was cancelled. This asks Razorpay what really happened to each
 * unconfirmed payment and records it through the same functions the webhook uses.
 */
export const reconcileUnconfirmedPayments = async (now = new Date()) => {
  const records = await prisma.paymentRecord.findMany({
    where: {
      providerOrderId: { not: null },
      status: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] },
      updatedAt: { lte: new Date(now.getTime() - RECONCILE_MIN_AGE_MS) },
      createdAt: { gte: new Date(now.getTime() - RECONCILE_MAX_AGE_MS) },
    },
    orderBy: { updatedAt: 'desc' },
    take: RECONCILE_BATCH,
    select: { id: true, providerOrderId: true },
  });

  const summary = { checked: 0, confirmed: 0, failed: 0, refundsUpdated: 0, refunded: 0, errors: 0 };
  for (const record of records) {
    const providerOrderId = record.providerOrderId!;
    try {
      const payments = await fetchRazorpayOrderPayments(providerOrderId);
      summary.checked += 1;

      const captured = payments.find((p) => p.status === 'captured');
      if (captured) {
        // Also refunds it if the order was cancelled, and alerts the admins if that refund fails.
        await markPaymentSucceeded(providerOrderId, captured.id);
        summary.confirmed += 1;
        continue;
      }

      for (const payment of payments.filter((p) => p.status === 'failed')) {
        await markPaymentFailed(providerOrderId, payment.id, payment.error_description ?? undefined);
        summary.failed += 1;
      }
    } catch (error) {
      // One bad record must not stop the rest. It is tried again on the next run.
      summary.errors += 1;
      console.error(`[CRON] Could not reconcile payment ${record.id}:`, error);
    }
  }

  // Refunds still waiting for Razorpay, in case the webhook that reports their result was missed.
  const waiting = await prisma.refund.findMany({
    where: { status: RefundStatus.PENDING, createdAt: { lte: new Date(now.getTime() - RECONCILE_MIN_AGE_MS) } },
    orderBy: { createdAt: 'desc' },
    take: RECONCILE_BATCH,
    select: { providerRefundId: true, paymentRecord: { select: { providerPaymentId: true } } },
  });
  const waitingByPayment = new Map<string, Set<string>>();
  for (const refund of waiting) {
    const paymentId = refund.paymentRecord.providerPaymentId;
    if (!paymentId) continue;
    waitingByPayment.set(paymentId, (waitingByPayment.get(paymentId) ?? new Set()).add(refund.providerRefundId));
  }
  for (const [paymentId, refundIds] of waitingByPayment) {
    try {
      for (const refund of await fetchRazorpayRefunds(paymentId)) {
        if (!refundIds.has(refund.id)) continue;
        const event = { id: refund.id, payment_id: paymentId, amount: refund.amount };
        if (refund.status === 'processed') await applyProcessedRefund(event);
        else if (refund.status === 'failed') await applyFailedRefund(event);
        else continue;
        summary.refundsUpdated += 1;
      }
    } catch (error) {
      summary.errors += 1;
      console.error(`[CRON] Could not check the refunds of payment ${paymentId}:`, error);
    }
  }

  // A cancelled order whose payment is still held: its refund failed or never ran. There is no age
  // limit, because this money must always go back. refundPayment checks Razorpay first, so a run
  // that overlaps a cancellation's own refund can't refund twice.
  const unrefunded = await prisma.paymentRecord.findMany({
    where: { status: PaymentStatus.SUCCESS, order: { status: OrderStatus.CANCELLED } },
    orderBy: { updatedAt: 'desc' },
    take: RECONCILE_BATCH,
    select: { id: true },
  });
  for (const record of unrefunded) {
    try {
      if ((await refundPayment(record.id, 'Order was cancelled')) === 'REFUNDED') summary.refunded += 1;
    } catch (error) {
      summary.errors += 1;
      console.error(`[CRON] Could not refund payment ${record.id} of a cancelled order:`, error);
    }
  }
  return summary;
};

type DisputeEvent = { id: string; payment_id: string; amount?: number; reason_code?: string | null };

/**
 * Records what happened to a dispute (chargeback) the buyer's bank raised on a payment, and tells
 * the admins, who have to answer it in the Razorpay dashboard. The order's own status is left
 * alone: a dispute doesn't change where the order is, and overwriting it would break its delivery.
 */
export const applyDispute = async (outcome: 'created' | 'won' | 'lost', entity: DisputeEvent) => {
  const record = await prisma.paymentRecord.findUnique({
    where: { providerPaymentId: entity.payment_id },
    select: { id: true, orderId: true, amount: true },
  });
  if (!record) return;

  // One alert per dispute and outcome, however often the webhook repeats.
  const key = `${entity.id}:${outcome}`;
  const alreadyHandled = await prisma.notification.findFirst({
    where: { data: { path: ['disputeEvent'], equals: key } },
    select: { id: true },
  });
  if (alreadyHandled) return;

  await prisma.paymentRecord.update({
    where: { id: record.id },
    data: { disputedAt: outcome === 'won' ? null : new Date() },
  });

  const amount = entity.amount ? paiseToRupees(entity.amount) : record.amount;
  const alerts = {
    created: {
      alertLevel: NotificationAlertLevel.CRITICAL,
      title: 'Payment disputed by the buyer\'s bank',
      body: `A dispute for ₹${amount} was raised on order ${record.orderId}${entity.reason_code ? ` (${entity.reason_code})` : ''}. Answer it in the Razorpay dashboard before its deadline, or the money is taken back.`,
    },
    won: {
      alertLevel: NotificationAlertLevel.SUCCESS,
      title: 'Payment dispute won',
      body: `The dispute for ₹${amount} on order ${record.orderId} was decided in our favour. No money was taken back.`,
    },
    lost: {
      alertLevel: NotificationAlertLevel.CRITICAL,
      title: 'Payment dispute lost',
      body: `The dispute for ₹${amount} on order ${record.orderId} was lost, and Razorpay has returned the money to the buyer. The farmer and partner earnings were not changed, so please review it.`,
    },
  };
  await notifyAdmins(prisma, { ...alerts[outcome], data: { orderId: record.orderId, disputeEvent: key } });
};
