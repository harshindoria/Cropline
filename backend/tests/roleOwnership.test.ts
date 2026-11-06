import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CropCategory, DeliveryType, PaymentType, Role, RoleAccessStatus } from '@prisma/client';
import prisma from '../src/config/db';
import { processRoleApplication } from '../src/controller/admin.controller';
import { onboardRole, setRoleBlock, switchRole } from '../src/controller/user.controller';
import { loadAccount } from '../src/utils/roles';
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

const rolesOf = async (id: string) => (await loadAccount(await prisma.user.findUniqueOrThrow({ where: { id } }))).roles;

const apply = async (userId: string, role: Role, status: RoleAccessStatus = RoleAccessStatus.PENDING_APPROVAL) =>
  prisma.userRoleAccess.create({ data: { userId, role, status } });

beforeEach(() => resetDatabase());
afterAll(() => prisma.$disconnect());

describe('holding a role', () => {
  it('does not give the role while the application is pending', async () => {
    const user = await makeUser();
    await apply(user.id, Role.FARMER);
    expect(await rolesOf(user.id)).toEqual([Role.BUYER]);
  });

  it('gives the role when an admin approves', async () => {
    const user = await makeUser();
    const application = await apply(user.id, Role.FARMER);

    const { status } = await call(processRoleApplication, { user: await makeAdmin(), params: { id: application.id }, body: { action: 'APPROVE' } });

    expect(status).toBe(200);
    expect(await rolesOf(user.id)).toEqual([Role.BUYER, Role.FARMER]);
  });

  it('does not give the role when an admin rejects', async () => {
    const user = await makeUser();
    const application = await apply(user.id, Role.FARMER);

    await call(processRoleApplication, { user: await makeAdmin(), params: { id: application.id }, body: { action: 'REJECT' } });

    expect(await rolesOf(user.id)).toEqual([Role.BUYER]);
    const after = await prisma.userRoleAccess.findUniqueOrThrow({ where: { id: application.id } });
    expect(after.status).toBe(RoleAccessStatus.REJECTED);
  });

  it('refuses to process an application twice', async () => {
    const user = await makeUser();
    const application = await apply(user.id, Role.FARMER);
    await call(processRoleApplication, { user: await makeAdmin(), params: { id: application.id }, body: { action: 'APPROVE' } });

    const { status } = await call(processRoleApplication, { user: await makeAdmin(), params: { id: application.id }, body: { action: 'REJECT' } });

    expect(status).toBe(409);
    expect(await rolesOf(user.id)).toContain(Role.FARMER);
  });

  it('keeps the role while it is blocked', async () => {
    const user = await makeUser({ roles: [Role.BUYER, Role.FARMER] });
    await prisma.userRoleAccess.update({
      where: { userId_role: { userId: user.id, role: Role.FARMER } },
      data: { status: RoleAccessStatus.BLOCKED },
    });
    expect(await rolesOf(user.id)).toContain(Role.FARMER);
  });

  it('lets a rejected user apply again, but not someone who already holds the role', async () => {
    const rejected = await makeUser();
    await apply(rejected.id, Role.FARMER, RoleAccessStatus.REJECTED);
    const again = await call(onboardRole, { user: rejected, body: { role: Role.FARMER } });
    expect(again.status).toBe(201);

    const holder = await makeUser({ roles: [Role.BUYER, Role.FARMER] });
    const repeat = await call(onboardRole, { user: holder, body: { role: Role.FARMER } });
    expect(repeat.status).toBe(409);
    expect(await rolesOf(holder.id)).toContain(Role.FARMER);
  });
});

describe('active role', () => {
  it('rejects switching to a role the user only applied for', async () => {
    const user = await makeUser();
    await apply(user.id, Role.FARMER);
    await expect(prisma.user.update({ where: { id: user.id }, data: { activeRole: Role.FARMER } })).rejects.toThrow(
      'User_activeRole_not_held',
    );
  });

  it('switches to a held role through the API and reports the roles', async () => {
    const user = await makeUser({ roles: [Role.BUYER, Role.FARMER] });
    const { body } = await call(switchRole, { user, body: { role: Role.FARMER } });
    expect(body.user.activeRole).toBe(Role.FARMER);
    expect([...body.user.roles].sort()).toEqual([Role.BUYER, Role.FARMER]);
  });

  it('rejects removing or un-approving the role the user is working in', async () => {
    const user = await makeUser();
    const where = { userId_role: { userId: user.id, role: Role.BUYER } };

    await expect(prisma.userRoleAccess.delete({ where })).rejects.toThrow('User_activeRole_not_held');
    await expect(
      prisma.userRoleAccess.update({ where, data: { status: RoleAccessStatus.REJECTED } }),
    ).rejects.toThrow('User_activeRole_not_held');
  });

  it('still allows deleting a user, which removes their roles', async () => {
    const user = await makeUser();
    await prisma.user.delete({ where: { id: user.id } });
    expect(await prisma.userRoleAccess.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe('blocking a role', () => {
  const admin = { id: 'admin' };

  it('cannot give someone a role they do not hold', async () => {
    const user = await makeUser();
    await apply(user.id, Role.FARMER);

    const blocked = await call(setRoleBlock, {
      user: admin,
      body: { userId: user.id, role: Role.FARMER, blocked: true, reason: 'Bad behaviour' },
    });
    const unblockedDelivery = await call(setRoleBlock, {
      user: admin,
      body: { userId: user.id, role: Role.DELIVERY, blocked: false },
    });

    expect(blocked.status).toBe(404);
    expect(unblockedDelivery.status).toBe(404);
    expect(await rolesOf(user.id)).toEqual([Role.BUYER]);
  });
});

describe('order and crop ownership', () => {
  const makeCrop = async (farmerId: string) => {
    const catalog = await makeCatalog();
    return prisma.crop.create({
      data: {
        farmerId,
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
  };
  const orderData = (cropId: string, farmerId: string, buyerId: string) => ({
    cropId,
    farmerId,
    buyerId,
    quantityKg: 10,
    basePricePerKg: 10,
    farmerEarnings: 100,
    cropMarkupRate: 0.2,
    platformFee: 20,
    totalBuyerPrice: 120,
    deliveryType: DeliveryType.SELF_PICKUP,
    paymentType: PaymentType.ONLINE,
  });

  it('accepts an order for the farmer who owns the crop', async () => {
    const farmer = await makeUser();
    const crop = await makeCrop(farmer.id);
    await prisma.order.create({ data: orderData(crop.id, farmer.id, (await makeUser()).id) });
    expect(await prisma.order.count()).toBe(1);
  });

  it("rejects an order that names a different farmer from the crop's owner", async () => {
    const crop = await makeCrop((await makeUser()).id);
    const someoneElse = await makeUser();
    await expect(
      prisma.order.create({ data: orderData(crop.id, someoneElse.id, (await makeUser()).id) }),
    ).rejects.toThrow();
  });
});
