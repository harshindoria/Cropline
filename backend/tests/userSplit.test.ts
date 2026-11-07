import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CropCategory, DeliveryType, OrderStatus, OtpKind, PaymentType, Role, VehicleType } from '@prisma/client';
import prisma from '../src/config/db';
import { getVerificationDocuments, verifyDocument } from '../src/controller/admin.controller';
import { getOrderById, getOrders } from '../src/controller/order.controller';
import { getFarmerPublicProfile, toggleOnlineStatus, updateProfile } from '../src/controller/user.controller';
import { checkOrderOtp, newOrderOtps } from '../src/services/orderOtp.service';
import { broadcastDeliveryOffer } from '../src/services/deliveryAssignment.service';
import { requestWithdrawal } from '../src/services/ledger.service';
import { decryptField, encryptField } from '../src/utils/fieldEncryption';
import { Prisma } from '@prisma/client';
import { makeCatalog, makeUser, resetDatabase } from './helpers';

vi.mock('../src/sockets/socket.handler', () => ({ disconnectUser: vi.fn(), getIO: vi.fn() }));
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

const makeOrder = async (farmer: { id: string }, buyer: { id: string }, status: OrderStatus = OrderStatus.PENDING) => {
  const catalog = await makeCatalog();
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
      buyerId: buyer.id,
      status,
      quantityKg: 10,
      basePricePerKg: 10,
      farmerEarnings: 100,
      cropMarkupRate: 0.2,
      platformFee: 20,
      totalBuyerPrice: 120,
      deliveryType: DeliveryType.DELIVERY,
      deliveryLatitude: 27,
      deliveryLongitude: 75.9,
      paymentType: PaymentType.ONLINE,
      otps: { create: newOrderOtps() },
    },
  });
};

beforeEach(() => resetDatabase());
afterAll(() => prisma.$disconnect());

describe('field encryption', () => {
  it('reads back what it stored, and encrypts the same value differently each time', () => {
    const first = encryptField('1234567890');
    expect(first).not.toContain('1234567890');
    expect(first).not.toBe(encryptField('1234567890'));
    expect(decryptField(first)).toBe('1234567890');
  });

  it('refuses a value that was tampered with', () => {
    const parts = encryptField('1234567890').split('.');
    parts[3] = Buffer.from('tampered').toString('base64');
    expect(() => decryptField(parts.join('.'))).toThrow();
  });
});

describe('profile update', () => {
  it('saves each field in its own table and returns one flat user', async () => {
    const user = await makeUser();

    const { status, body } = await call(updateProfile, {
      user,
      body: { name: 'Ramesh', farmArea: 5, soilType: 'Clay', vehicleType: 'BIKE', bankName: 'SBI', aadhaarLast4: '1234' },
    });

    expect(status).toBe(200);
    expect(body.user).toMatchObject({
      name: 'Ramesh',
      farmArea: 5,
      soilType: 'Clay',
      vehicleType: 'BIKE',
      bankName: 'SBI',
      aadhaarLast4: '1234',
    });
    expect((await prisma.farmerProfile.findUniqueOrThrow({ where: { userId: user.id } })).farmArea).toBe(5);
    expect((await prisma.deliveryProfile.findUniqueOrThrow({ where: { userId: user.id } })).vehicleType).toBe('BIKE');
  });

  it('saves a date of birth sent as a plain date or a full date', async () => {
    const user = await makeUser();
    const savedDob = async () => (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).dob?.toISOString();

    const plain = await call(updateProfile, { user, body: { dob: '2000-05-06' } });
    expect(plain.status).toBe(200);
    expect(await savedDob()).toBe('2000-05-06T00:00:00.000Z');

    const full = await call(updateProfile, { user, body: { dob: '1999-01-02T00:00:00.000Z' } });
    expect(full.status).toBe(200);
    expect(await savedDob()).toBe('1999-01-02T00:00:00.000Z');
  });

  it('refuses a future or invalid date of birth, and explains why', async () => {
    const user = await makeUser();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const future = await call(updateProfile, { user, body: { dob: tomorrow } });
    expect(future.status).toBe(400);
    expect(future.body.message).toBe('Date of birth cannot be in the future.');

    expect((await call(updateProfile, { user, body: { dob: 'not a date' } })).status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).dob).toBeNull();
  });

  it('stores the bank account and documents encrypted, and never returns them', async () => {
    const user = await makeUser();

    const { body } = await call(updateProfile, {
      user,
      body: { bankAccount: '1234567890', bankIfsc: 'SBIN0001234', aadhaarUrl: 'data:image/png;base64,AAAA' },
    });

    const bank = await prisma.bankDetails.findUniqueOrThrow({ where: { userId: user.id } });
    const kyc = await prisma.kycDocuments.findUniqueOrThrow({ where: { userId: user.id } });
    expect(bank.bankAccount).not.toContain('1234567890');
    expect(decryptField(bank.bankAccount!)).toBe('1234567890');
    expect(kyc.aadhaarUrl).not.toContain('AAAA');
    expect(JSON.stringify(body)).not.toContain(bank.bankAccount);
    expect(JSON.stringify(body)).not.toContain(kyc.aadhaarUrl);
  });

  it('treats an empty document as removing it', async () => {
    const user = await makeUser();
    await call(updateProfile, { user, body: { dlUrl: 'data:image/png;base64,AAAA' } });
    await call(updateProfile, { user, body: { dlUrl: '' } });
    expect((await prisma.kycDocuments.findUniqueOrThrow({ where: { userId: user.id } })).dlUrl).toBeNull();
  });

  it('shows a farmer profile with its farm details', async () => {
    const farmer = await makeUser({ roles: [Role.BUYER, Role.FARMER] });
    await prisma.cropCatalog.create({ data: { englishName: 'Wheat', hindiName: 'Gehu', category: 'GRAINS' } });
    await call(updateProfile, { user: farmer, body: { primaryCrops: 'wheat' } });

    const { body } = await call(getFarmerPublicProfile, { params: { id: farmer.id }, user: farmer });

    expect(JSON.stringify(body)).toContain('Wheat');
    expect(JSON.stringify(body)).not.toContain('farmerProfile');
  });

  it('rejects a primary crop that is not on the platform', async () => {
    const farmer = await makeUser({ roles: [Role.BUYER, Role.FARMER] });
    const { status } = await call(updateProfile, { user: farmer, body: { primaryCrops: 'Moonfruit' } });
    expect(status).toBe(400);
  });
});

describe('withdrawing', () => {
  it('copies the encrypted bank details onto the payout', async () => {
    const user = await makeUser({ walletBalance: 500, bankAccount: '1234567890', bankIfsc: 'SBIN0001234', bankName: 'SBI' });

    const payout = await requestWithdrawal(user, new Prisma.Decimal(100));

    const detail = await prisma.payoutDetail.findUniqueOrThrow({ where: { ledgerEntryId: payout.id } });
    expect(detail.bankAccount).not.toContain('1234567890');
    expect(decryptField(detail.bankAccount)).toBe('1234567890');
    expect(detail.bankName).toBe('SBI');
  });
});

describe('admin documents', () => {
  it('shows the decrypted document and verifying it approves the application', async () => {
    const user = await makeUser();
    await prisma.userRoleAccess.create({ data: { userId: user.id, role: Role.FARMER, status: 'PENDING_APPROVAL' } });
    await call(updateProfile, { user, body: { aadhaarUrl: 'data:image/png;base64,AAAA' } });
    const admin = await makeUser({ roles: [Role.ADMIN], activeRole: Role.ADMIN });

    const list = await call(getVerificationDocuments, { query: {} });
    expect(JSON.stringify(list.body)).toContain('data:image/png;base64,AAAA');

    await call(verifyDocument, { user: admin, body: { userId: user.id, docType: 'aadhaar', status: true } });

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const access = await prisma.userRoleAccess.findUniqueOrThrow({ where: { userId_role: { userId: user.id, role: Role.FARMER } } });
    expect(after.isVerified).toBe(true);
    expect(access.status).toBe('ACTIVE');
  });
});

describe('delivery partner profile', () => {
  it('goes online through the profile, and only then receives offers', async () => {
    const farmer = await makeUser({ roles: [Role.BUYER, Role.FARMER], latitude: 26.9, longitude: 75.8 });
    const partner = await makeUser({ roles: [Role.BUYER, Role.DELIVERY], latitude: 26.9, longitude: 75.8 });
    await call(updateProfile, { user: partner, body: { vehicleType: 'MINI_TRUCK' } });
    const order = await makeOrder(farmer, await makeUser(), OrderStatus.DELIVERY_SEARCHING);

    expect(await broadcastDeliveryOffer(order.id)).toBe(0);

    const { body } = await call(toggleOnlineStatus, { user: partner, body: { isOnline: true } });
    expect(body.data.isOnline).toBe(true);

    expect(await broadcastDeliveryOffer(order.id)).toBe(1);
    const profile = await prisma.deliveryProfile.findUniqueOrThrow({ where: { userId: partner.id } });
    expect(profile.vehicleType).toBe(VehicleType.MINI_TRUCK);
  });
});

describe('order OTPs', () => {
  const setUp = async () => {
    const farmer = await makeUser();
    const buyer = await makeUser();
    const order = await makeOrder(farmer, buyer);
    const code = async (kind: OtpKind) =>
      (await prisma.orderOtp.findUniqueOrThrow({ where: { orderId_kind: { orderId: order.id, kind } } })).code;
    return { farmer, buyer, order, code };
  };

  it('shows the buyer only the delivery code and the farmer only the pickup code', async () => {
    const { farmer, buyer, order, code } = await setUp();
    const view = (user: { id: string }) => call(getOrderById, { user, params: { id: order.id } });

    const asBuyer = (await view(buyer)).body.order;
    const asFarmer = (await view(farmer)).body.order;

    expect(asBuyer.deliveryOtp).toBe(await code(OtpKind.DELIVERY));
    expect(asBuyer.pickupOtp).toBeNull();
    expect(asFarmer.pickupOtp).toBe(await code(OtpKind.PICKUP));
    expect(asFarmer.deliveryOtp).toBeNull();
    expect(asBuyer.otps).toBeUndefined();
  });

  it('applies the same rule to the order list', async () => {
    const { farmer, code } = await setUp();
    const { body } = await call(getOrders, { user: farmer });
    expect(body.orders[0].pickupOtp).toBe(await code(OtpKind.PICKUP));
    expect(body.orders[0].deliveryOtp).toBeNull();
  });

  it('accepts the right code', async () => {
    const { order, code } = await setUp();
    expect(await checkOrderOtp(order.id, OtpKind.PICKUP, await code(OtpKind.PICKUP))).toBe('OK');
  });

  it('locks after 5 wrong tries, even for the right code', async () => {
    const { order, code } = await setUp();
    const right = await code(OtpKind.DELIVERY);
    const wrong = right === '1000' ? '1001' : '1000';

    for (let i = 0; i < 4; i++) expect(await checkOrderOtp(order.id, OtpKind.DELIVERY, wrong)).toBe('INVALID');
    expect(await checkOrderOtp(order.id, OtpKind.DELIVERY, wrong)).toBe('LOCKED');
    expect(await checkOrderOtp(order.id, OtpKind.DELIVERY, right)).toBe('LOCKED');
  });

  it('allows the right code again once the lock has passed', async () => {
    const { order, code } = await setUp();
    await prisma.orderOtp.update({
      where: { orderId_kind: { orderId: order.id, kind: OtpKind.DELIVERY } },
      data: { lockedUntil: new Date(Date.now() - 1000) },
    });
    expect(await checkOrderOtp(order.id, OtpKind.DELIVERY, await code(OtpKind.DELIVERY))).toBe('OK');
  });

  it('allows only one code of each kind per order', async () => {
    const { order } = await setUp();
    await expect(prisma.orderOtp.create({ data: { orderId: order.id, kind: OtpKind.PICKUP, code: '1111' } })).rejects.toThrow();
  });
});
