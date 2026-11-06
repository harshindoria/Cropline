import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeliveryType, OrderStatus, PaymentType, Role, RoleAccessStatus } from '@prisma/client';
import prisma from '../src/config/db';
import { acceptJob, cancelJob, getNearbyJobs } from '../src/controller/delivery.controller';
import { markReady } from '../src/controller/order.controller';
import { toggleOnlineStatus } from '../src/controller/user.controller';
import { processRetryDeliveryAssignments } from '../src/services/cron.service';
import { loadAccount } from '../src/utils/roles';
import { makeCatalog, makeUser, resetDatabase } from './helpers';

vi.mock('../src/sockets/socket.handler', () => ({
  disconnectUser: vi.fn(),
  getIO: vi.fn(() => ({ to: () => ({ emit: vi.fn() }) })),
}));
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

const FARM = { lat: 27.5, lng: 74.5 };
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);

// The farmer's profile has no location, and everything must still work from the crop's location.
const setUpOrder = async (status: OrderStatus = OrderStatus.CONFIRMED) => {
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
      farmLatitude: FARM.lat,
      farmLongitude: FARM.lng,
      farmVillage: 'Kerap',
      farmDistrict: 'Didwana',
      farmState: 'Rajasthan',
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
      deliveryFee: 50,
      deliveryCommissionRate: 0.2,
      deliveryPlatformFee: 10,
      deliveryPartnerPayout: 40,
      totalBuyerPrice: 170,
      deliveryType: DeliveryType.DELIVERY,
      deliveryLatitude: 27.6,
      deliveryLongitude: 74.6,
      paymentType: PaymentType.CASH,
      ...(status === OrderStatus.DELIVERY_SEARCHING && { dispatchStartedAt: new Date() }),
    },
  });
  return { farmer, buyer, crop, order };
};

const makePartner = async (location: { lat: number; lng: number } | null = FARM, isOnline = true) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: {
      id: (
        await makeUser({
          roles: [Role.BUYER, Role.DELIVERY],
          activeRole: Role.DELIVERY,
          latitude: location?.lat,
          longitude: location?.lng,
        })
      ).id,
    },
  });
  await prisma.deliveryProfile.create({ data: { userId: user.id, vehicleType: 'BIKE', isOnline } });
  return loadAccount(user);
};

const offersFor = (orderId: string) => prisma.deliveryOffer.findMany({ where: { orderId }, orderBy: { wave: 'asc' } });
const statusOf = async (id: string) => (await prisma.order.findUniqueOrThrow({ where: { id } })).status;

beforeEach(() => resetDatabase());
afterAll(() => prisma.$disconnect());

describe('from ready to delivery partner', () => {
  it('searches as soon as the farmer is ready, and a partner can accept', async () => {
    const { farmer, order } = await setUpOrder();
    const partner = await makePartner();

    const ready = await call(markReady, { user: farmer, params: { id: order.id } });

    expect(ready.status).toBe(200);
    const saved = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.status).toBe(OrderStatus.DELIVERY_SEARCHING);
    expect(saved.dispatchStartedAt).not.toBeNull();
    expect(await offersFor(order.id)).toHaveLength(1);

    const nearby = await call(getNearbyJobs, { user: partner, query: { lat: FARM.lat, lng: FARM.lng, radius: 20 } });
    expect(nearby.body.data.jobs.map((job: any) => job.orderId)).toEqual([order.id]);

    const accepted = await call(acceptJob, { user: partner, params: { orderId: order.id } });
    expect(accepted.status).toBe(201);
    expect(await statusOf(order.id)).toBe(OrderStatus.ASSIGNED);
  });

  it('keeps a self pickup order out of the partner search', async () => {
    const { farmer, order } = await setUpOrder();
    await prisma.order.update({ where: { id: order.id }, data: { deliveryType: DeliveryType.SELF_PICKUP } });
    await makePartner();

    await call(markReady, { user: farmer, params: { id: order.id } });

    expect(await statusOf(order.id)).toBe(OrderStatus.READY_FOR_PICKUP);
    expect(await offersFor(order.id)).toHaveLength(0);
  });

  it('accepts a weight the offer allowed for that vehicle', async () => {
    const { farmer, order } = await setUpOrder();
    await prisma.order.update({ where: { id: order.id }, data: { quantityKg: 40 } });
    const partner = await makePartner();

    await call(markReady, { user: farmer, params: { id: order.id } });

    expect((await call(acceptJob, { user: partner, params: { orderId: order.id } })).status).toBe(201);
  });
});

describe('who gets offers', () => {
  const offeredTo = async (orderId: string) => (await offersFor(orderId)).map((offer) => offer.partnerId);

  it('measures from the farm, not the farmer profile', async () => {
    const { farmer, order } = await setUpOrder();
    const near = await makePartner({ lat: FARM.lat + 0.01, lng: FARM.lng });
    await makePartner({ lat: 12.97, lng: 77.59 });

    await call(markReady, { user: farmer, params: { id: order.id } });

    expect(await offeredTo(order.id)).toEqual([near.id]);
  });

  it('skips partners with no location, offline partners and blocked partners', async () => {
    const { farmer, order } = await setUpOrder();
    await makePartner(null);
    await makePartner(FARM, false);
    const blocked = await makePartner();
    await prisma.userRoleAccess.update({
      where: { userId_role: { userId: blocked.id, role: Role.DELIVERY } },
      data: { status: RoleAccessStatus.BLOCKED },
    });

    await call(markReady, { user: farmer, params: { id: order.id } });

    expect(await offeredTo(order.id)).toEqual([]);
  });

  it('does not list a job this partner was not offered', async () => {
    await setUpOrder(OrderStatus.DELIVERY_SEARCHING);
    const partner = await makePartner();
    const nearby = await call(getNearbyJobs, { user: partner, query: { lat: FARM.lat, lng: FARM.lng, radius: 20 } });
    expect(nearby.body.data.jobs).toEqual([]);
  });
});

describe('when nobody accepts', () => {
  const ignoredOffer = async (startedHoursAgo: number) => {
    const { order, crop } = await setUpOrder(OrderStatus.DELIVERY_SEARCHING);
    const partner = await makePartner();
    await prisma.order.update({ where: { id: order.id }, data: { dispatchStartedAt: hoursAgo(startedHoursAgo) } });
    await prisma.deliveryOffer.create({
      data: { orderId: order.id, partnerId: partner.id, wave: 1, radiusKm: 10, expiresAt: hoursAgo(0.1) },
    });
    return { order, crop, partner };
  };

  it('expires the old offer and offers the same partner again in a new wave', async () => {
    const { order } = await ignoredOffer(2.5);

    await processRetryDeliveryAssignments();

    const offers = await offersFor(order.id);
    expect(offers.map((offer) => [offer.wave, offer.status])).toEqual([
      [1, 'EXPIRED'],
      [2, 'OFFERED'],
    ]);
  });

  it('leaves an offer alone while there is still time to accept it', async () => {
    const { order } = await setUpOrder(OrderStatus.DELIVERY_SEARCHING);
    const partner = await makePartner();
    await prisma.deliveryOffer.create({
      data: { orderId: order.id, partnerId: partner.id, wave: 1, radiusKm: 10, expiresAt: new Date(Date.now() + 60_000) },
    });

    await processRetryDeliveryAssignments();

    expect((await offersFor(order.id)).map((offer) => offer.status)).toEqual(['OFFERED']);
  });

  it('cancels the order after 4 hours and restores the stock, even with a partner still online', async () => {
    const { order, crop } = await ignoredOffer(4.5);

    await processRetryDeliveryAssignments();

    expect(await statusOf(order.id)).toBe(OrderStatus.CANCELLED);
    const after = await prisma.crop.findUniqueOrThrow({ where: { id: crop.id } });
    expect(Number(after.quantityRemainingKg)).toBe(200);
  });
});

describe('when a partner drops out', () => {
  const assigned = async () => {
    const { farmer, buyer, order } = await setUpOrder();
    const partner = await makePartner();
    await call(markReady, { user: farmer, params: { id: order.id } });
    await call(acceptJob, { user: partner, params: { orderId: order.id } });
    const job = await prisma.deliveryJob.findFirstOrThrow({ where: { orderId: order.id } });
    return { farmer, buyer, order, partner, job };
  };

  it('offers the order to someone else, but not to the partner who left', async () => {
    const { order, partner, job } = await assigned();
    const other = await makePartner();

    const result = await call(cancelJob, { user: partner, params: { jobId: job.id } });

    expect(result.status).toBe(200);
    expect(await statusOf(order.id)).toBe(OrderStatus.DELIVERY_SEARCHING);
    const cancelled = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelledAt).not.toBeNull();
    const open = (await offersFor(order.id)).filter((offer) => offer.status === 'OFFERED');
    expect(open.map((offer) => offer.partnerId)).toEqual([other.id]);

    expect((await call(acceptJob, { user: other, params: { orderId: order.id } })).status).toBe(201);
    expect(await prisma.deliveryJob.count({ where: { orderId: order.id } })).toBe(2);
  });

  it('tells the buyer and farmer', async () => {
    const { buyer, farmer, partner, job } = await assigned();
    await call(cancelJob, { user: partner, params: { jobId: job.id } });

    for (const user of [buyer, farmer]) {
      expect(await prisma.notification.count({ where: { userId: user.id, title: { contains: 'new delivery partner' } } })).toBe(1);
    }
  });

  it("does not let someone else cancel a partner's job", async () => {
    const { job } = await assigned();
    const stranger = await makePartner();
    expect((await call(cancelJob, { user: stranger, params: { jobId: job.id } })).status).toBe(404);
    expect((await prisma.deliveryJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('ASSIGNED');
  });

  it('refuses after pickup, because the goods are with the partner', async () => {
    const { partner, job } = await assigned();
    await prisma.deliveryJob.update({ where: { id: job.id }, data: { status: 'PICKED_UP' } });
    expect((await call(cancelJob, { user: partner, params: { jobId: job.id } })).status).toBe(409);
  });

  it('releases a job automatically when nobody picks it up in time', async () => {
    const { order, job } = await assigned();
    await prisma.deliveryJob.update({ where: { id: job.id }, data: { acceptedAt: hoursAgo(3) } });

    await processRetryDeliveryAssignments();

    expect((await prisma.deliveryJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('CANCELLED');
    expect(await statusOf(order.id)).toBe(OrderStatus.DELIVERY_SEARCHING);
  });

  it('leaves a recently accepted job alone', async () => {
    const { job } = await assigned();
    await processRetryDeliveryAssignments();
    expect((await prisma.deliveryJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('ASSIGNED');
  });
});

describe('going online', () => {
  it('needs a location, and saves the one it is given', async () => {
    const partner = await makePartner(null, false);

    const without = await call(toggleOnlineStatus, { user: partner, body: { isOnline: true } });
    expect(without.status).toBe(400);
    expect(without.body.code).toBe('LOCATION_REQUIRED');

    const withLocation = await call(toggleOnlineStatus, {
      user: partner,
      body: { isOnline: true, latitude: FARM.lat, longitude: FARM.lng },
    });
    expect(withLocation.status).toBe(200);
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: partner.id } });
    expect(saved.latitude).toBe(FARM.lat);
  });

  it('can always go offline', async () => {
    const partner = await makePartner(null);
    expect((await call(toggleOnlineStatus, { user: partner, body: { isOnline: false } })).status).toBe(200);
  });
});
