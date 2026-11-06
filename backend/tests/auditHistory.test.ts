import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CropCategory, DeliveryType, OrderStatus, PaymentType, Role, RoleAccessStatus } from '@prisma/client';
import prisma from '../src/config/db';
import { processComplaint, processRoleApplication } from '../src/controller/admin.controller';
import { setRoleBlock } from '../src/controller/user.controller';
import { requireRoleOperational } from '../src/middleware/role.middleware';
import { makeUser, resetDatabase } from './helpers';

vi.mock('../src/sockets/socket.handler', () => ({ disconnectUser: vi.fn(), getIO: vi.fn() }));
vi.mock('../src/services/deliveryAssignment.service', () => ({ broadcastDeliveryOffer: vi.fn() }));
vi.mock('../src/services/payment.service', () => ({ issueRazorpayRefund: vi.fn() }));

const call = async (handler: (req: any, res: any) => Promise<void>, req: Record<string, unknown>) => {
  let status = 200;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json() {
      return this;
    },
  };
  await handler(req, res);
  return status;
};

const makeAdmin = () => makeUser({ roles: [Role.ADMIN], activeRole: Role.ADMIN });

const makeOrder = async () => {
  const farmer = await makeUser();
  const catalog = await prisma.cropCatalog.create({
    data: { englishName: 'Potato', hindiName: 'Aloo', category: CropCategory.VEGETABLES },
  });
  const crop = await prisma.crop.create({
    data: {
      farmerId: farmer.id,
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
      farmerId: farmer.id,
      buyerId: (await makeUser()).id,
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
};

const orderHistory = (orderId: string) =>
  prisma.orderStatusHistory.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } });

const accessFor = (userId: string, role: Role) =>
  prisma.userRoleAccess.findUniqueOrThrow({ where: { userId_role: { userId, role } } });

const events = async (userId: string, role: Role) =>
  prisma.roleAccessEvent.findMany({
    where: { userRoleAccess: { userId, role } },
    orderBy: { createdAt: 'asc' },
  });

beforeEach(() => resetDatabase());
afterAll(() => prisma.$disconnect());

describe('order status history', () => {
  it('records the first status and every change, including what came before a dispute', async () => {
    const order = await makeOrder();

    await prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.DELIVERED } });
    await prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.DISPUTED } });

    const history = await orderHistory(order.id);
    expect(history.map((row) => [row.fromStatus, row.toStatus])).toEqual([
      [null, OrderStatus.PENDING],
      [OrderStatus.PENDING, OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED, OrderStatus.DISPUTED],
    ]);
  });

  it('adds nothing when another field changes or the status stays the same', async () => {
    const order = await makeOrder();

    await prisma.order.update({ where: { id: order.id }, data: { deliveryAddress: 'New address' } });
    await prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.PENDING } });

    expect(await orderHistory(order.id)).toHaveLength(1);
  });

  it('cannot be changed or deleted, and keeps the order from being deleted', async () => {
    const order = await makeOrder();
    const [row] = await orderHistory(order.id);

    await expect(
      prisma.orderStatusHistory.update({ where: { id: row.id }, data: { toStatus: OrderStatus.CANCELLED } }),
    ).rejects.toThrow('OrderStatusHistory_permanent');
    await expect(prisma.orderStatusHistory.delete({ where: { id: row.id } })).rejects.toThrow(
      'OrderStatusHistory_permanent',
    );
    await expect(prisma.order.delete({ where: { id: order.id } })).rejects.toThrow();
  });
});

describe('role history', () => {
  it('records an application and the admin who approved it', async () => {
    const user = await makeUser();
    const admin = await makeAdmin();
    const application = await prisma.userRoleAccess.create({
      data: { userId: user.id, role: Role.FARMER, status: RoleAccessStatus.PENDING_APPROVAL },
    });

    await call(processRoleApplication, { user: admin, params: { id: application.id }, body: { action: 'APPROVE' } });

    const rows = await events(user.id, Role.FARMER);
    expect(rows.map((row) => [row.fromStatus, row.toStatus, row.changedByAdminId])).toEqual([
      [null, RoleAccessStatus.PENDING_APPROVAL, null],
      [RoleAccessStatus.PENDING_APPROVAL, RoleAccessStatus.ACTIVE, admin.id],
    ]);
  });

  it('keeps earlier blocks after the role is unblocked and blocked again', async () => {
    const user = await makeUser({ roles: [Role.BUYER, Role.FARMER] });
    const admin = await makeAdmin();
    const block = (reason: string) =>
      call(setRoleBlock, { user: admin, body: { userId: user.id, role: Role.FARMER, blocked: true, reason } });

    await block('First reason');
    await call(setRoleBlock, { user: admin, body: { userId: user.id, role: Role.FARMER, blocked: false } });
    await block('Second reason');

    const rows = (await events(user.id, Role.FARMER)).slice(1);
    expect(rows.map((row) => [row.toStatus, row.reason, row.changedByAdminId])).toEqual([
      [RoleAccessStatus.BLOCKED, 'First reason', admin.id],
      [RoleAccessStatus.ACTIVE, null, admin.id],
      [RoleAccessStatus.BLOCKED, 'Second reason', admin.id],
    ]);
  });

  it('records a block that ends by itself with no admin', async () => {
    const user = await makeUser({ roles: [Role.BUYER, Role.FARMER], activeRole: Role.FARMER });
    const admin = await makeAdmin();
    await prisma.userRoleAccess.update({
      where: { userId_role: { userId: user.id, role: Role.FARMER } },
      data: {
        status: RoleAccessStatus.BLOCKED,
        blockedUntil: new Date(Date.now() - 1000),
        changedByAdminId: admin.id,
      },
    });

    const next = vi.fn();
    await requireRoleOperational(Role.FARMER)({ user } as any, {} as any, next);

    expect(next).toHaveBeenCalled();
    expect((await accessFor(user.id, Role.FARMER)).status).toBe(RoleAccessStatus.ACTIVE);
    const last = (await events(user.id, Role.FARMER)).at(-1)!;
    expect([last.toStatus, last.changedByAdminId]).toEqual([RoleAccessStatus.ACTIVE, null]);
  });

  it('still allows deleting a user with role history', async () => {
    const user = await makeUser();
    await prisma.user.delete({ where: { id: user.id } });
    expect(await prisma.roleAccessEvent.count()).toBe(0);
  });
});

describe('admin actions', () => {
  const makeComplaint = async () =>
    prisma.complaint.create({
      data: {
        complainerId: (await makeUser()).id,
        accusedId: (await makeUser()).id,
        accusedRole: Role.BUYER,
        reason: 'Late',
      },
    });

  it('records who resolved a complaint', async () => {
    const complaint = await makeComplaint();
    const admin = await makeAdmin();

    await call(processComplaint, { user: admin, params: { id: complaint.id }, body: { action: 'DISMISS' } });

    const after = await prisma.complaint.findUniqueOrThrow({ where: { id: complaint.id } });
    expect(after.resolvedByAdminId).toBe(admin.id);
    expect(after.resolvedAt).not.toBeNull();
  });

  it('does not count asking for more evidence as resolving it', async () => {
    const complaint = await makeComplaint();

    await call(processComplaint, {
      user: await makeAdmin(),
      params: { id: complaint.id },
      body: { action: 'REQUEST_MORE_EVIDENCE' },
    });

    const after = await prisma.complaint.findUniqueOrThrow({ where: { id: complaint.id } });
    expect(after.status).toBe('UNDER_REVIEW');
    expect(after.resolvedByAdminId).toBeNull();
  });

  it('rejects an admin id on a cash record that belongs to nobody', async () => {
    const order = await makeOrder();
    const partner = await makeUser();
    await expect(
      prisma.cashLiability.create({
        data: { orderId: order.id, deliveryPartnerId: partner.id, amount: 120, reconciledByAdminId: 'nobody' },
      }),
    ).rejects.toThrow();
  });
});
