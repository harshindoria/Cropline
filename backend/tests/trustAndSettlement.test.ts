import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeliveryType, OrderStatus, PaymentType, Role } from '@prisma/client';
import prisma from '../src/config/db';
import { processComplaint } from '../src/controller/admin.controller';
import { createComplaint } from '../src/controller/complaint.controller';
import { verifyCashDeposit } from '../src/controller/transaction.controller';
import { setRoleBlock, updateProfile } from '../src/controller/user.controller';
import { applyProcessedRefund } from '../src/services/paymentRecord.service';
import { makeCatalog, makeUser, resetDatabase } from './helpers';

vi.mock('../src/sockets/socket.handler', () => ({ disconnectUser: vi.fn(), getIO: vi.fn() }));
vi.mock('../src/services/deliveryAssignment.service', () => ({ broadcastDeliveryOffer: vi.fn() }));
vi.mock('../src/services/payment.service', () => ({ issueRazorpayRefund: vi.fn() }));

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

const makeAdmin = () => makeUser({ roles: [Role.ADMIN], activeRole: Role.ADMIN });

const setUpOrder = async (status: OrderStatus = OrderStatus.DELIVERED) => {
  const farmer = await makeUser({ roles: [Role.BUYER, Role.FARMER] });
  const buyer = await makeUser();
  const crop = await prisma.crop.create({
    data: {
      farmerId: farmer.id,
      catalogId: (await makeCatalog()).id,
      quantityKg: 200,
      quantityRemainingKg: 190,
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
  const order = await prisma.order.create({
    data: {
      cropId: crop.id,
      farmerId: farmer.id,
      buyerId: buyer.id,
      status,
      quantityKg: 10,
      basePricePerKg: 10,
      farmerEarnings: 100,
      cropMarkupRate: 0.2,
      platformFee: 20,
      totalBuyerPrice: 120,
      deliveryType: DeliveryType.SELF_PICKUP,
      paymentType: PaymentType.ONLINE,
    },
  });
  return { farmer, buyer, order };
};

const complain = (user: unknown, orderId: string, accusedId: string, reason = 'Late Delivery') =>
  call(createComplaint, { user, body: { orderId, accusedId, reason } });

beforeEach(() => resetDatabase());
afterAll(() => prisma.$disconnect());

describe('cash settlement', () => {
  it('lets an admin settle cash that was never marked as deposited, and records when', async () => {
    const { buyer, order } = await setUpOrder();
    const liability = await prisma.cashLiability.create({ data: { orderId: order.id, deliveryPartnerId: buyer.id, amount: 120 } });

    const { status } = await call(verifyCashDeposit, { user: await makeAdmin(), params: { id: liability.id } });

    expect(status).toBe(200);
    const after = await prisma.cashLiability.findUniqueOrThrow({ where: { id: liability.id } });
    expect(after.status).toBe('VERIFIED');
    expect(after.depositedAt).not.toBeNull();
  });
});

describe('refund on a delivered order', () => {
  const setUp = async (status: OrderStatus) => {
    const { order, farmer } = await setUpOrder(status);
    await prisma.user.update({ where: { id: farmer.id }, data: { walletBalance: 100 } });
    await prisma.paymentRecord.create({
      data: { orderId: order.id, provider: 'RAZORPAY', amount: 120, status: 'SUCCESS', providerPaymentId: 'pay_1' },
    });
    return { admin: await makeAdmin(), farmer };
  };
  const refund = () => applyProcessedRefund({ id: 'rfnd_1', payment_id: 'pay_1', amount: 12000 });
  const alerts = (userId: string) => prisma.notification.count({ where: { userId, title: 'Refund on a delivered order' } });

  it('alerts the admins once, and takes no money from anyone', async () => {
    const { admin, farmer } = await setUp(OrderStatus.DELIVERED);

    await refund();
    await refund();

    expect(await alerts(admin.id)).toBe(1);
    expect(Number((await prisma.user.findUniqueOrThrow({ where: { id: farmer.id } })).walletBalance)).toBe(100);
  });

  it('does not alert for an order that was not delivered', async () => {
    const { admin } = await setUp(OrderStatus.CANCELLED);
    await refund();
    expect(await alerts(admin.id)).toBe(0);
  });
});

describe('filing a complaint', () => {
  it('records it with the accused person\'s role on this order', async () => {
    const { buyer, farmer, order } = await setUpOrder();

    const { status } = await complain(buyer, order.id, farmer.id);

    expect(status).toBe(201);
    const complaint = await prisma.complaint.findFirstOrThrow();
    expect(complaint.accusedRole).toBe(Role.FARMER);
    expect(complaint.complainerId).toBe(buyer.id);
    expect(complaint.status).toBe('PENDING');
  });

  it('lets a buyer complain about the partner on the order, but not one whose job was cancelled', async () => {
    const { buyer, order } = await setUpOrder();
    const job = (deliveryPartnerId: string, extra: object) =>
      prisma.deliveryJob.create({
        data: {
          orderId: order.id,
          deliveryPartnerId,
          pickupLatitude: 1,
          pickupLongitude: 1,
          dropLatitude: 1,
          dropLongitude: 1,
          distanceKm: 1,
          cropWeightKg: 10,
          ...extra,
        },
      });
    const left = await makeUser();
    const current = await makeUser();
    await job(left.id, { status: 'CANCELLED', cancelledAt: new Date() });
    await job(current.id, {});

    expect((await complain(buyer, order.id, left.id)).status).toBe(400);
    expect((await complain(buyer, order.id, current.id)).status).toBe(201);
    expect((await prisma.complaint.findFirstOrThrow()).accusedRole).toBe(Role.DELIVERY);
  });

  it('refuses someone who is not on the order', async () => {
    const { farmer, order } = await setUpOrder();
    expect((await complain(await makeUser(), order.id, farmer.id)).status).toBe(403);
  });

  it('refuses a complaint about someone not on the order, or about yourself', async () => {
    const { buyer, order } = await setUpOrder();
    expect((await complain(buyer, order.id, (await makeUser()).id)).status).toBe(400);
    expect((await complain(buyer, order.id, buyer.id)).status).toBe(400);
  });

  it('refuses a second complaint about the same person on the same order', async () => {
    const { buyer, farmer, order } = await setUpOrder();
    await complain(buyer, order.id, farmer.id);
    expect((await complain(buyer, order.id, farmer.id, 'Fraud')).status).toBe(409);
    expect(await prisma.complaint.count()).toBe(1);
  });

  it('refuses a reason outside the list', async () => {
    const { buyer, farmer, order } = await setUpOrder();
    expect((await complain(buyer, order.id, farmer.id, 'Made up')).status).toBe(400);
  });
});

describe('processing a complaint', () => {
  const setUp = async () => {
    const { buyer, farmer, order } = await setUpOrder();
    await complain(buyer, order.id, farmer.id);
    return { farmer, complaint: await prisma.complaint.findFirstOrThrow(), admin: await makeAdmin() };
  };
  const strikes = async (id: string) => (await prisma.user.findUniqueOrThrow({ where: { id } })).strikeCount;
  const approve = (admin: unknown, id: string) => call(processComplaint, { user: admin, params: { id }, body: { action: 'APPROVE' } });

  it('adds one strike, and refuses to approve the same complaint again', async () => {
    const { farmer, complaint, admin } = await setUp();

    expect((await approve(admin, complaint.id)).status).toBe(200);
    expect((await approve(admin, complaint.id)).status).toBe(409);

    expect(await strikes(farmer.id)).toBe(1);
  });

  it('adds one strike when two admins approve at the same moment', async () => {
    const { farmer, complaint, admin } = await setUp();

    await Promise.all([approve(admin, complaint.id), approve(admin, complaint.id)]);

    expect(await strikes(farmer.id)).toBe(1);
  });

  it('can still be approved after asking for more evidence', async () => {
    const { farmer, complaint, admin } = await setUp();
    await call(processComplaint, { user: admin, params: { id: complaint.id }, body: { action: 'REQUEST_MORE_EVIDENCE' } });

    expect((await approve(admin, complaint.id)).status).toBe(200);
    expect(await strikes(farmer.id)).toBe(1);
  });

  it('blocks the role at 10 strikes, says how to appeal, and unblocking clears the fee', async () => {
    const { farmer, complaint, admin } = await setUp();
    await prisma.user.update({ where: { id: farmer.id }, data: { strikeCount: 9 } });

    await approve(admin, complaint.id);

    const where = { userId_role: { userId: farmer.id, role: Role.FARMER } };
    const blocked = await prisma.userRoleAccess.findUniqueOrThrow({ where });
    expect(blocked.status).toBe('BLOCKED');
    expect(blocked.unbanFeeStatus).toBe('PENDING');
    const notice = await prisma.notification.findFirstOrThrow({ where: { userId: farmer.id, title: 'Role Blocked' } });
    expect(notice.body).toContain('contact support');

    await call(setRoleBlock, { user: admin, body: { userId: farmer.id, role: Role.FARMER, blocked: false } });

    const after = await prisma.userRoleAccess.findUniqueOrThrow({ where });
    expect(after.status).toBe('ACTIVE');
    expect(after.unbanFeeStatus).toBe('NONE');
    expect(after.unbanFeeAmount).toBeNull();
  });
});

describe('replacing a verified document', () => {
  const kyc = (userId: string) => prisma.kycDocuments.findUniqueOrThrow({ where: { userId } });

  it('clears the approval of that document only', async () => {
    const user = await makeUser({ isVerified: true });
    await prisma.kycDocuments.create({
      data: { userId: user.id, aadhaarUrl: 'x', aadhaarVerified: true, dlUrl: 'y', dlVerified: true },
    });

    await call(updateProfile, { user, body: { dlUrl: 'data:image/png;base64,BBBB' } });

    expect((await kyc(user.id)).dlVerified).toBe(false);
    expect((await kyc(user.id)).aadhaarVerified).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).isVerified).toBe(true);
  });

  it('also clears the verified badge when the Aadhaar changes', async () => {
    const user = await makeUser({ isVerified: true });
    await prisma.kycDocuments.create({ data: { userId: user.id, aadhaarUrl: 'x', aadhaarVerified: true } });

    await call(updateProfile, { user, body: { aadhaarUrl: 'data:image/png;base64,BBBB' } });

    expect((await kyc(user.id)).aadhaarVerified).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).isVerified).toBe(false);
  });

  it('keeps approvals when other profile fields change', async () => {
    const user = await makeUser({ isVerified: true });
    await prisma.kycDocuments.create({ data: { userId: user.id, aadhaarUrl: 'x', aadhaarVerified: true } });

    await call(updateProfile, { user, body: { name: 'New name', aadhaarLast4: '1234' } });

    expect((await kyc(user.id)).aadhaarVerified).toBe(true);
  });
});
