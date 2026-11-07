import { Request, Response } from 'express';
import { LedgerEntryStatus, LedgerEntryType, Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../config/db';
import { processWithdrawal, requestWithdrawal, WalletError } from '../services/ledger.service';
import { decryptField } from '../utils/fieldEncryption';

const withdrawalSchema = z.object({
  amount: z
    .union([z.number(), z.string()])
    .refine((value) => /^\d+(\.\d{1,2})?$/.test(String(value)) && Number(value) > 0, {
      message: 'Enter an amount above zero, with at most 2 decimal places.',
    }),
});

const processSchema = z.object({
  action: z.enum(['PAID', 'REJECTED'], { message: "action must be 'PAID' or 'REJECTED'" }),
});

const sendWalletError = (res: Response, error: unknown, label: string): void => {
  if (error instanceof WalletError) {
    res.status(error.status).json({ success: false, code: error.code, message: error.message });
    return;
  }
  console.error(`${label} Error:`, error);
  res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
};

export const createWithdrawal = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = withdrawalSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: parsed.error.issues[0].message });
      return;
    }

    const payout = await requestWithdrawal(req.user!, new Prisma.Decimal(String(parsed.data.amount)));
    res.status(201).json({ success: true, data: payout });
  } catch (error) {
    sendWalletError(res, error, 'Create Withdrawal');
  }
};

export const getMyWithdrawals = async (req: Request, res: Response): Promise<void> => {
  try {
    const withdrawals = await prisma.ledgerEntry.findMany({
      where: { userId: req.user!.id, type: LedgerEntryType.PAYOUT },
      orderBy: { createdAt: 'desc' },
      select: { id: true, amount: true, status: true, createdAt: true, settledAt: true },
    });
    res.status(200).json({ success: true, data: withdrawals });
  } catch (error) {
    sendWalletError(res, error, 'Get Withdrawals');
  }
};

export const getPendingWithdrawals = async (req: Request, res: Response): Promise<void> => {
  try {
    const withdrawals = await prisma.ledgerEntry.findMany({
      where: { type: LedgerEntryType.PAYOUT, status: LedgerEntryStatus.AWAITING_TRANSFER },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        amount: true,
        createdAt: true,
        user: { select: { id: true, name: true, phone: true } },
        payoutDetail: {
          select: { bankAccount: true, bankIfsc: true, bankName: true, accountHolderName: true },
        },
      },
    });

    // Admin must pay the account saved with the request, even if the profile has changed since.
    const data = withdrawals.map(({ user, payoutDetail, ...withdrawal }) => ({
      ...withdrawal,
      user: user && { ...user, ...payoutDetail, bankAccount: payoutDetail && decryptField(payoutDetail.bankAccount) },
    }));
    res.status(200).json({ success: true, data });
  } catch (error) {
    sendWalletError(res, error, 'Get Pending Withdrawals');
  }
};

export const processWithdrawalRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = processSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: parsed.error.issues[0].message });
      return;
    }

    const payout = await processWithdrawal(req.params.id as string, parsed.data.action, req.user!.id);
    res.status(200).json({ success: true, data: payout });
  } catch (error) {
    sendWalletError(res, error, 'Process Withdrawal');
  }
};
