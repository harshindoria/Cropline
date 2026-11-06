import { LedgerEntryStatus, LedgerEntryType, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import prisma from '../config/db';

type Tx = Prisma.TransactionClient;

export class WalletError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'WalletError';
    Object.setPrototypeOf(this, WalletError.prototype);
  }
}

type DeliveredOrder = {
  id: string;
  farmerId: string;
  farmerEarnings: Prisma.Decimal;
  platformFee: Prisma.Decimal;
  deliveryPlatformFee: Prisma.Decimal;
  deliveryPartnerPayout: Prisma.Decimal;
};

const EARNING_TYPES: LedgerEntryType[] = [LedgerEntryType.FARMER_EARNING, LedgerEntryType.DELIVERY_EARNING];

/**
 * Records where every rupee of a delivered order goes. The unique idempotency keys make a repeat
 * of this call fail, which rolls back its whole transaction, so an order can never pay out twice.
 *
 * Cash orders are held as PENDING, because the money is still with the delivery partner.
 */
export const recordDeliveredOrder = async (
  tx: Tx,
  order: DeliveredOrder,
  deliveryPartnerId: string,
  options: { cashStillWithPartner: boolean },
): Promise<void> => {
  const held = options.cashStillWithPartner;
  const now = new Date();

  const earning = {
    status: held ? LedgerEntryStatus.PENDING : LedgerEntryStatus.AVAILABLE,
    availableAt: held ? null : now,
  };
  const fee = {
    status: held ? LedgerEntryStatus.PENDING : LedgerEntryStatus.SETTLED,
    settledAt: held ? null : now,
  };

  const entries: Prisma.LedgerEntryCreateManyInput[] = [
    { type: LedgerEntryType.FARMER_EARNING, userId: order.farmerId, amount: order.farmerEarnings, ...earning },
    { type: LedgerEntryType.DELIVERY_EARNING, userId: deliveryPartnerId, amount: order.deliveryPartnerPayout, ...earning },
    { type: LedgerEntryType.PLATFORM_CROP_FEE, amount: order.platformFee, ...fee },
    { type: LedgerEntryType.PLATFORM_DELIVERY_FEE, amount: order.deliveryPlatformFee, ...fee },
  ]
    .filter((entry) => entry.amount.gt(0))
    .map((entry) => ({ ...entry, orderId: order.id, idempotencyKey: `order:${order.id}:${entry.type}` }));

  await tx.ledgerEntry.createMany({ data: entries });

  if (!held) {
    for (const entry of entries) {
      if (entry.userId) {
        await tx.user.update({ where: { id: entry.userId }, data: { walletBalance: { increment: entry.amount } } });
      }
    }
  }
};

const releaseHeldEntries = async (tx: Tx, orderId: string): Promise<void> => {
  const held = await tx.ledgerEntry.findMany({ where: { orderId, status: LedgerEntryStatus.PENDING } });
  const now = new Date();

  for (const entry of held) {
    if (!EARNING_TYPES.includes(entry.type)) {
      await tx.ledgerEntry.update({
        where: { id: entry.id },
        data: { status: LedgerEntryStatus.SETTLED, settledAt: now },
      });
      continue;
    }

    await tx.ledgerEntry.update({
      where: { id: entry.id },
      data: { status: LedgerEntryStatus.AVAILABLE, availableAt: now },
    });
    if (entry.userId) {
      await tx.user.update({ where: { id: entry.userId }, data: { walletBalance: { increment: entry.amount } } });
      await tx.notification.create({
        data: {
          userId: entry.userId,
          title: 'Earnings added to wallet 💰',
          body: `₹${entry.amount} from a cash order is now in your wallet.`,
          data: { orderId },
        },
      });
    }
  }
};

/**
 * Marks a partner's cash as received and releases that order's held money. Returns false if it
 * was already settled, so a repeated webhook or a second admin click pays nobody twice.
 */
export const settleCashLiability = async (tx: Tx, liabilityId: string, adminId?: string): Promise<boolean> => {
  const claimed = await tx.cashLiability.updateMany({
    where: { id: liabilityId, reconciledAt: null },
    data: { status: 'VERIFIED', reconciledAt: new Date(), reconciledByAdminId: adminId ?? null },
  });
  if (claimed.count !== 1) return false;

  const { orderId } = await tx.cashLiability.findUniqueOrThrow({
    where: { id: liabilityId },
    select: { orderId: true },
  });
  await releaseHeldEntries(tx, orderId);
  return true;
};

type WithdrawingUser = {
  id: string;
  bankAccount: string | null;
  bankIfsc: string | null;
  bankName: string | null;
  accountHolderName: string | null;
};

/**
 * Takes the money out of the wallet straight away and creates a PENDING payout for admin to pay.
 * The wallet update locks the user's row, so simultaneous requests are handled one at a time.
 */
export const requestWithdrawal = async (user: WithdrawingUser, amount: Prisma.Decimal) => {
  const { bankAccount, bankIfsc, bankName, accountHolderName } = user;
  if (!bankAccount || !bankIfsc) {
    throw new WalletError(400, 'BANK_DETAILS_REQUIRED', 'Please add your bank account and IFSC in your profile first.');
  }

  return prisma.$transaction(async (tx) => {
    const debited = await tx.user.updateMany({
      where: { id: user.id, walletBalance: { gte: amount } },
      data: { walletBalance: { decrement: amount } },
    });
    if (debited.count !== 1) {
      throw new WalletError(409, 'INSUFFICIENT_BALANCE', 'This is more than your wallet balance.');
    }

    const pending = await tx.ledgerEntry.count({
      where: { userId: user.id, type: LedgerEntryType.PAYOUT, status: LedgerEntryStatus.PENDING },
    });
    if (pending > 0) {
      throw new WalletError(409, 'WITHDRAWAL_PENDING', 'You already have a withdrawal being processed.');
    }

    const unpaidCash = await tx.cashLiability.count({ where: { deliveryPartnerId: user.id, reconciledAt: null } });
    if (unpaidCash > 0) {
      throw new WalletError(409, 'CASH_DEPOSIT_PENDING', 'Please deposit the cash you have collected before withdrawing.');
    }

    return tx.ledgerEntry.create({
      data: {
        userId: user.id,
        type: LedgerEntryType.PAYOUT,
        status: LedgerEntryStatus.PENDING,
        amount,
        idempotencyKey: `payout:${randomUUID()}`,
        payoutDetail: { create: { bankAccount, bankIfsc, bankName, accountHolderName } },
      },
    });
  });
};

/**
 * Completes a pending payout: PAID after admin has sent the bank transfer, or REJECTED, which
 * returns the money to the wallet. A payout can only leave PENDING once.
 */
export const processWithdrawal = async (payoutId: string, action: 'PAID' | 'REJECTED', adminId: string) =>
  prisma.$transaction(async (tx) => {
    const paid = action === 'PAID';
    const claimed = await tx.ledgerEntry.updateMany({
      where: { id: payoutId, type: LedgerEntryType.PAYOUT, status: LedgerEntryStatus.PENDING },
      data: paid ? { status: LedgerEntryStatus.SETTLED, settledAt: new Date() } : { status: LedgerEntryStatus.FAILED },
    });

    if (claimed.count !== 1) {
      const existing = await tx.ledgerEntry.findFirst({ where: { id: payoutId, type: LedgerEntryType.PAYOUT } });
      if (!existing) throw new WalletError(404, 'WITHDRAWAL_NOT_FOUND', 'Withdrawal request not found.');
      throw new WalletError(409, 'WITHDRAWAL_ALREADY_PROCESSED', 'This withdrawal was already processed.');
    }

    await tx.payoutDetail.updateMany({
      where: { ledgerEntryId: payoutId },
      data: { processedByAdminId: adminId, processedAt: new Date() },
    });

    const payout = await tx.ledgerEntry.findUniqueOrThrow({ where: { id: payoutId } });
    if (!payout.userId) return payout;

    if (!paid) {
      await tx.user.update({ where: { id: payout.userId }, data: { walletBalance: { increment: payout.amount } } });
    }
    await tx.notification.create({
      data: {
        userId: payout.userId,
        alertLevel: paid ? 'SUCCESS' : 'WARNING',
        title: paid ? 'Withdrawal paid ✅' : 'Withdrawal rejected',
        body: paid
          ? `₹${payout.amount} has been sent to your bank account.`
          : `Your withdrawal of ₹${payout.amount} was rejected, and the money is back in your wallet.`,
      },
    });
    return payout;
  });
