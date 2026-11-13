import { NotificationAlertLevel, Prisma } from '@prisma/client';
import prisma from '../config/db';
import { settleCashLiability } from './ledger.service';
import { fetchRazorpayRefunds, issueRazorpayRefund } from './payment.service';
import { notifyAdmins } from './paymentRecord.service';

export type SettlementPayment = {
  /** The Razorpay payment made through the settlement link. */
  paymentId: string;
  driverId: string;
  /** One liability's ID, or 'ALL' for every one the partner owed when the link was made. */
  liabilityId: string;
  amountPaidPaise: number;
  /** When the link was made, so 'ALL' settles what the partner saw then, not what was added since. */
  linkCreatedAt?: Date;
};

const rupees = (paise: number) => new Prisma.Decimal(paise).div(100);

/**
 * Settles a delivery partner's cash from a settlement-link payment, and refunds any part of the
 * payment that settled nothing: a second link paid for the same cash, a liability an admin has
 * verified in the meantime, or an amount that doesn't cover the liability.
 *
 * Safe to run again for the same payment (Razorpay repeats webhooks). The liabilities it settles
 * are marked with the payment, so a repeat settles nothing new and only retries a refund that
 * didn't go through. Throws if that refund fails, so the webhook is retried.
 */
export const applySettlementPayment = async (payment: SettlementPayment): Promise<{ settled: number; refundedPaise: number }> => {
  const paid = rupees(payment.amountPaidPaise);

  const { settled, used } = await prisma.$transaction(async (tx) => {
    // Locks the partner's liabilities, so two webhooks for them are handled one after the other.
    await tx.$queryRaw`SELECT id FROM "CashLiability" WHERE "deliveryPartnerId" = ${payment.driverId} FOR UPDATE`;

    const alreadySettled = await tx.cashLiability.findMany({
      where: { settlementPaymentId: payment.paymentId },
      select: { amount: true },
    });
    if (alreadySettled.length > 0) {
      return { settled: 0, used: alreadySettled.reduce((sum, l) => sum.plus(l.amount), new Prisma.Decimal(0)) };
    }

    const open = await tx.cashLiability.findMany({
      where: {
        deliveryPartnerId: payment.driverId,
        reconciledAt: null,
        ...(payment.liabilityId !== 'ALL'
          ? { id: payment.liabilityId }
          : payment.linkCreatedAt && { createdAt: { lte: payment.linkCreatedAt } }),
      },
      orderBy: { createdAt: 'asc' },
    });

    // Oldest first, each one only if what is left of the payment covers it in full.
    let used = new Prisma.Decimal(0);
    let settled = 0;
    for (const liability of open) {
      if (paid.minus(used).lt(liability.amount)) continue;
      if (await settleCashLiability(tx, liability.id, undefined, payment.paymentId)) {
        used = used.plus(liability.amount);
        settled += 1;
      }
    }
    return { settled, used };
  });

  const unused = paid.minus(used);
  if (unused.lte(0)) return { settled, refundedPaise: 0 };

  await refundUnusedSettlement(payment, unused);
  return { settled, refundedPaise: unused.mul(100).toNumber() };
};

const refundUnusedSettlement = async (payment: SettlementPayment, amount: Prisma.Decimal) => {
  // A refund from an earlier run of this webhook means it is done.
  const existing = (await fetchRazorpayRefunds(payment.paymentId)).filter((r) => r.status !== 'failed');
  if (existing.length > 0) return;

  try {
    await issueRazorpayRefund(payment.paymentId, amount.toNumber(), {
      reason: 'Part of a cash settlement payment that settled nothing',
    });
  } catch (error) {
    await alertAdminsSettlementRefundFailed(payment, amount, error).catch((alertError) =>
      console.error(`Could not alert admins about settlement payment ${payment.paymentId}:`, alertError),
    );
    throw error;
  }

  await prisma.notification.create({
    data: {
      userId: payment.driverId,
      alertLevel: NotificationAlertLevel.INFO,
      title: 'Extra settlement payment refunded',
      body: `₹${amount} of your cash settlement payment was not needed, because that cash was already settled. It has been refunded to you.`,
      data: { settlementPaymentId: payment.paymentId },
    },
  });
};

/** One alert per payment, however often the webhook retries. */
const alertAdminsSettlementRefundFailed = async (payment: SettlementPayment, amount: Prisma.Decimal, error: unknown) => {
  const alreadyAlerted = await prisma.notification.findFirst({
    where: { data: { path: ['settlementRefundFailedFor'], equals: payment.paymentId } },
    select: { id: true },
  });
  if (alreadyAlerted) return;

  const cause = error instanceof Error ? error.message : String(error);
  await notifyAdmins(prisma, {
    alertLevel: NotificationAlertLevel.CRITICAL,
    title: 'Settlement refund failed: partner money is held',
    body: `A delivery partner paid ₹${amount} more than their cash due (payment ${payment.paymentId}), and Razorpay refused to refund it (${cause}). Refund it from the Razorpay dashboard.`,
    data: { driverId: payment.driverId, settlementRefundFailedFor: payment.paymentId },
  });
};
