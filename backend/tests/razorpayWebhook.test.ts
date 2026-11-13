import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'crypto';
import { AddressInfo } from 'net';
import { Server } from 'http';
import express from 'express';
import { DeliveryType, PaymentStatus, PaymentType } from '@prisma/client';
import prisma from '../src/config/db';
import { parseJsonBody } from '../src/middleware/body.middleware';
import paymentRoutes from '../src/routes/payment.routes';
import { makeCatalog, makeUser, resetDatabase } from './helpers';

// The real payment service is used, so only the Razorpay SDK it builds at import time is replaced.
vi.mock('razorpay', () => ({ default: class {} }));
vi.mock('../src/sockets/socket.handler', () => ({ disconnectUser: vi.fn(), getIO: vi.fn() }));

const SECRET = 'webhook_test_secret';
let server: Server;
let baseUrl: string;

// Same middleware order as index.ts, so the body goes through the real JSON parser.
beforeAll(async () => {
  vi.stubEnv('RAZORPAY_WEBHOOK_SECRET', SECRET);
  const app = express();
  app.use(parseJsonBody);
  app.use('/api/v1/payments', paymentRoutes);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(resetDatabase);

afterAll(async () => {
  vi.unstubAllEnvs();
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

const makePendingPayment = async () => {
  const farmer = await makeUser();
  const buyer = await makeUser();
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
  const order = await prisma.order.create({
    data: {
      cropId: crop.id,
      farmerId: farmer.id,
      buyerId: buyer.id,
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
    },
  });
  return prisma.paymentRecord.create({
    data: { orderId: order.id, provider: 'RAZORPAY', providerOrderId: `order_${order.id}`, amount: 120 },
  });
};

// Razorpay signs the exact bytes it sends. The spacing here differs from JSON.stringify's output,
// so the test fails if the server re-serialises the parsed body instead of using the original bytes.
const capturedEvent = (providerOrderId: string) =>
  `{ "event": "payment.captured",  "payload": { "payment": { "entity": { "id": "pay_1", "order_id": "${providerOrderId}" } } } }`;

const send = (body: string, signature: string) =>
  fetch(`${baseUrl}/api/v1/payments/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-razorpay-signature': signature },
    body,
  });

const sign = (body: string, secret = SECRET) => createHmac('sha256', secret).update(body).digest('hex');

describe('Razorpay webhook over HTTP', () => {
  it('accepts a correctly signed event and marks the payment successful', async () => {
    const record = await makePendingPayment();
    const body = capturedEvent(record.providerOrderId!);

    const res = await send(body, sign(body));

    expect(res.status).toBe(200);
    const after = await prisma.paymentRecord.findUniqueOrThrow({ where: { id: record.id } });
    expect(after.status).toBe(PaymentStatus.SUCCESS);
    expect(after.providerPaymentId).toBe('pay_1');
  });

  it('rejects an event signed with the wrong secret and changes nothing', async () => {
    const record = await makePendingPayment();
    const body = capturedEvent(record.providerOrderId!);

    const res = await send(body, sign(body, 'wrong_secret'));

    expect(res.status).toBe(400);
    const after = await prisma.paymentRecord.findUniqueOrThrow({ where: { id: record.id } });
    expect(after.status).toBe(PaymentStatus.PENDING);
  });

  it('rejects a body that was changed after it was signed', async () => {
    const record = await makePendingPayment();
    const signed = capturedEvent(record.providerOrderId!);

    const res = await send(signed.replace('pay_1', 'pay_2'), sign(signed));

    expect(res.status).toBe(400);
  });
});
