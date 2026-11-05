import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@prisma/client';
import prisma from '../src/config/db';
import {
  createWithdrawal,
  getMyWithdrawals,
  getPendingWithdrawals,
  processWithdrawalRequest,
} from '../src/controller/wallet.controller';
import { makeUser, resetDatabase } from './helpers';

const call = async (handler: (req: any, res: any) => Promise<void>, req: Record<string, unknown>) => {
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

const makeEarner = (walletBalance = 1000) =>
  makeUser({
    roles: [Role.BUYER, Role.FARMER],
    activeRole: Role.FARMER,
    walletBalance,
    bankAccount: '1234567890',
    bankIfsc: 'SBIN0001234',
    bankName: 'SBI',
    accountHolderName: 'Ramesh',
  });

const withdraw = (user: unknown, amount: unknown) => call(createWithdrawal, { user, body: { amount } });
const process_ = (id: string, action: string) => call(processWithdrawalRequest, { params: { id }, body: { action } });
const wallet = async (id: string) => Number((await prisma.user.findUniqueOrThrow({ where: { id } })).walletBalance);

beforeEach(resetDatabase);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('requesting a withdrawal', () => {
  it('takes the money from the wallet and creates a pending payout', async () => {
    const user = await makeEarner();

    const result = await withdraw(user, 400.5);

    expect(result.status).toBe(201);
    expect(await wallet(user.id)).toBe(599.5);
    const payout = await prisma.ledgerEntry.findFirstOrThrow();
    expect(payout.type).toBe('PAYOUT');
    expect(payout.status).toBe('PENDING');
    expect(payout.orderId).toBeNull();
    expect(Number(payout.amount)).toBe(400.5);
  });

  it('allows withdrawing the whole balance', async () => {
    const user = await makeEarner();
    expect((await withdraw(user, 1000)).status).toBe(201);
    expect(await wallet(user.id)).toBe(0);
  });

  it('refuses more than the wallet holds', async () => {
    const user = await makeEarner();
    const result = await withdraw(user, 1000.01);
    expect(result.status).toBe(409);
    expect(result.body.code).toBe('INSUFFICIENT_BALANCE');
    expect(await wallet(user.id)).toBe(1000);
  });

  it.each([0, -5, 10.123, 'abc', null])('refuses the amount %s', async (amount) => {
    const user = await makeEarner();
    expect((await withdraw(user, amount)).status).toBe(400);
    expect(await wallet(user.id)).toBe(1000);
  });

  it('refuses without bank details', async () => {
    const user = await makeUser({ walletBalance: 1000 });
    const result = await withdraw(user, 100);
    expect(result.status).toBe(400);
    expect(result.body.code).toBe('BANK_DETAILS_REQUIRED');
  });

  it('refuses a second request while one is pending, and leaves the wallet correct', async () => {
    const user = await makeEarner();
    await withdraw(user, 100);

    const second = await withdraw(user, 100);

    expect(second.status).toBe(409);
    expect(second.body.code).toBe('WITHDRAWAL_PENDING');
    expect(await wallet(user.id)).toBe(900);
  });

  it('accepts only one of several simultaneous requests', async () => {
    const user = await makeEarner();

    const results = await Promise.all(Array.from({ length: 5 }, () => withdraw(user, 300)));

    expect(results.filter((result) => result.status === 201)).toHaveLength(1);
    expect(await wallet(user.id)).toBe(700);
    expect(await prisma.ledgerEntry.count()).toBe(1);
  });

  it('refuses a delivery partner who has not deposited collected cash', async () => {
    const partner = await makeEarner();
    const buyer = await makeUser();
    const farmer = await makeUser();
    const catalog = await prisma.cropCatalog.create({ data: { englishName: 'P', hindiName: 'A', category: 'OTHER' } });
    const crop = await prisma.crop.create({
      data: {
        farmerId: farmer.id, catalogId: catalog.id, quantityKg: 10, quantityRemainingKg: 10, basePricePerKg: 10,
        minOrderKg: 1, harvestDate: new Date(), farmLatitude: 1, farmLongitude: 1, farmVillage: 'v', farmDistrict: 'd', farmState: 's',
      },
    });
    const order = await prisma.order.create({
      data: {
        cropId: crop.id, buyerId: buyer.id, farmerId: farmer.id, quantityKg: 10, basePricePerKg: 10, farmerEarnings: 100,
        cropMarkupRate: 0.2, platformFee: 20, totalBuyerPrice: 120, deliveryType: 'DELIVERY', paymentType: 'CASH_ON_PICKUP',
      },
    });
    await prisma.cashLiability.create({ data: { orderId: order.id, deliveryPartnerId: partner.id, amount: 120 } });

    const result = await withdraw(partner, 100);

    expect(result.status).toBe(409);
    expect(result.body.code).toBe('CASH_DEPOSIT_PENDING');
    expect(await wallet(partner.id)).toBe(1000);
  });

  it("lists only the user's own withdrawals", async () => {
    const user = await makeEarner();
    const other = await makeEarner();
    await withdraw(user, 100);
    await withdraw(other, 100);

    const result = await call(getMyWithdrawals, { user });

    expect(result.body.data).toHaveLength(1);
  });
});

describe('admin processing a withdrawal', () => {
  it('shows pending requests with the bank details needed to pay them', async () => {
    const user = await makeEarner();
    await withdraw(user, 100);

    const result = await call(getPendingWithdrawals, {});

    expect(result.body.data).toHaveLength(1);
    expect(result.body.data[0].user.bankAccount).toBe('1234567890');
  });

  it('marks a payout paid without changing the wallet again', async () => {
    const user = await makeEarner();
    const { body } = await withdraw(user, 100);

    const result = await process_(body.data.id, 'PAID');

    expect(result.status).toBe(200);
    const payout = await prisma.ledgerEntry.findFirstOrThrow();
    expect(payout.status).toBe('SETTLED');
    expect(payout.settledAt).not.toBeNull();
    expect(await wallet(user.id)).toBe(900);
    expect(await prisma.notification.count({ where: { userId: user.id } })).toBe(1);
  });

  it('returns the money when a payout is rejected', async () => {
    const user = await makeEarner();
    const { body } = await withdraw(user, 100);

    const result = await process_(body.data.id, 'REJECTED');

    expect(result.status).toBe(200);
    expect((await prisma.ledgerEntry.findFirstOrThrow()).status).toBe('FAILED');
    expect(await wallet(user.id)).toBe(1000);
  });

  it('lets the user withdraw again after a payout finishes', async () => {
    const user = await makeEarner();
    const { body } = await withdraw(user, 100);
    await process_(body.data.id, 'PAID');

    expect((await withdraw(user, 100)).status).toBe(201);
  });

  it('cannot process a payout twice', async () => {
    const user = await makeEarner();
    const { body } = await withdraw(user, 100);
    await process_(body.data.id, 'REJECTED');

    const again = await process_(body.data.id, 'REJECTED');

    expect(again.status).toBe(409);
    expect(await wallet(user.id)).toBe(1000);
  });

  it('returns the money only once when rejected twice at the same moment', async () => {
    const user = await makeEarner();
    const { body } = await withdraw(user, 100);

    const results = await Promise.all([process_(body.data.id, 'REJECTED'), process_(body.data.id, 'REJECTED')]);

    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(await wallet(user.id)).toBe(1000);
  });

  it('cannot both pay and reject a payout', async () => {
    const user = await makeEarner();
    const { body } = await withdraw(user, 100);
    await process_(body.data.id, 'PAID');

    expect((await process_(body.data.id, 'REJECTED')).status).toBe(409);
    expect(await wallet(user.id)).toBe(900);
  });

  it('returns 404 for an unknown id and 400 for an unknown action', async () => {
    expect((await process_('missing', 'PAID')).status).toBe(404);
    expect((await process_('missing', 'MAYBE')).status).toBe(400);
  });
});

describe('database rules', () => {
  it('rejects a negative wallet', async () => {
    await expect(makeUser({ walletBalance: -1 })).rejects.toThrow('User_wallet_non_negative_check');
  });

  it('rejects a negative ledger amount', async () => {
    const user = await makeUser();
    await expect(
      prisma.ledgerEntry.create({ data: { userId: user.id, type: 'PAYOUT', amount: -1, idempotencyKey: 'a' } }),
    ).rejects.toThrow('LedgerEntry_amount_non_negative_check');
  });

  it('requires an order on every ledger entry except a payout', async () => {
    const user = await makeUser();
    await expect(
      prisma.ledgerEntry.create({ data: { userId: user.id, type: 'FARMER_EARNING', amount: 1, idempotencyKey: 'a' } }),
    ).rejects.toThrow('LedgerEntry_order_required_check');
  });
});
