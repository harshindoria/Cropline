import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@prisma/client';
import prisma from '../src/config/db';
import authRoutes from '../src/routes/auth.routes';
import { changePhone, loginWithPhone } from '../src/controller/auth.controller';
import { buyerProfile, updateProfile } from '../src/controller/user.controller';
import { makeUser, resetDatabase } from './helpers';

// A "token" in these tests is the JSON Firebase would have verified, e.g. {uid, phone_number}.
vi.mock('../src/config/firebase', () => ({
  firebaseAuth: {
    verifyIdToken: vi.fn(async (token: string) => {
      if (token === 'forged') throw new Error('bad signature');
      return JSON.parse(token);
    }),
  },
}));
vi.mock('../src/sockets/socket.handler', () => ({ disconnectUser: vi.fn() }));

const token = (uid: string, phone_number?: string, email?: string) => JSON.stringify({ uid, phone_number, email });

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

const login = (idToken: string) => call(loginWithPhone, { body: { idToken } });

beforeEach(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('login', () => {
  it('creates one account for a new number, stored in the verified format', async () => {
    const result = await login(token('uid-a', '+919876543210'));

    expect(result.status).toBe(200);
    expect(result.body.isNewUser).toBe(true);
    const users = await prisma.user.findMany();
    expect(users).toHaveLength(1);
    expect(users[0].phone).toBe('+919876543210');
  });

  it('returns the same account every time the same number logs in', async () => {
    const first = await login(token('uid-a', '+919876543210'));
    const second = await login(token('uid-a', '+919876543210'));

    expect(second.body.isNewUser).toBe(false);
    expect(second.body.safeUser.id).toBe(first.body.safeUser.id);
    expect(await prisma.user.count()).toBe(1);
  });

  it('finds the existing account even when Firebase issues a different UID for the number', async () => {
    const existing = await makeUser({ phone: '+919876543210', firebaseUid: 'old-google-uid' });

    const result = await login(token('new-phone-uid', '+919876543210'));

    expect(result.body.isNewUser).toBe(false);
    expect(result.body.safeUser.id).toBe(existing.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: existing.id } })).firebaseUid).toBe('new-phone-uid');
    expect(await prisma.user.count()).toBe(1);
  });

  it('creates only one account when two first logins race', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => login(token('uid-a', '+919876543210'))));

    expect(results.map((result) => result.status)).toEqual([200, 200, 200, 200, 200]);
    expect(new Set(results.map((result) => result.body.safeUser.id)).size).toBe(1);
    expect(await prisma.user.count()).toBe(1);
  });

  it('rejects a Google-style token that has an email but no verified phone', async () => {
    const result = await login(token('google-uid', undefined, 'someone@gmail.com'));

    expect(result.status).toBe(400);
    expect(result.body.code).toBe('PHONE_NOT_VERIFIED');
    expect(await prisma.user.count()).toBe(0);
  });

  it('rejects numbers outside India before creating anything', async () => {
    const result = await login(token('uid-a', '+14155552671'));

    expect(result.status).toBe(400);
    expect(result.body.code).toBe('UNSUPPORTED_PHONE');
    expect(await prisma.user.count()).toBe(0);
  });

  it('rejects a forged token', async () => {
    const result = await login('forged');

    expect(result.status).toBe(401);
    expect(await prisma.user.count()).toBe(0);
  });

  it('no longer has a route for logging in with email', () => {
    const paths = authRoutes.stack.map((layer: any) => layer.route?.path);
    expect(paths).not.toContain('/login/email');
    expect(paths).toContain('/login/phone');
  });
});

describe('email is only contact information', () => {
  it('cannot be used to take over an account: a typed email never affects who logs in', async () => {
    const attacker = await makeUser({ phone: '+919111111111' });
    await call(updateProfile, { user: attacker, body: { email: 'victim@gmail.com' } });

    const victim = await login(token('victim-uid', '+919222222222', 'victim@gmail.com'));

    expect(victim.body.isNewUser).toBe(true);
    expect(victim.body.safeUser.id).not.toBe(attacker.id);
  });

  it('lets two accounts have the same email, so nobody can block an address', async () => {
    const first = await makeUser({ email: 'shared@example.com' });
    const second = await makeUser();

    const result = await call(updateProfile, { user: second, body: { email: 'shared@example.com' } });

    expect(result.status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: first.id } })).email).toBe('shared@example.com');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: second.id } })).email).toBe('shared@example.com');
  });

  it("does not grant admin to someone who types the owner's email", async () => {
    const user = await makeUser();
    await call(updateProfile, { user, body: { email: 'harshindoria911@gmail.com' } });

    await call(buyerProfile, { user });

    const adminAccess = await prisma.userRoleAccess.count({ where: { userId: user.id, role: Role.ADMIN } });
    expect(adminAccess).toBe(0);
  });
});

describe('phone number changes', () => {
  it('ignores a phone number sent to the profile endpoint', async () => {
    const user = await makeUser({ phone: '+919111111111' });

    const result = await call(updateProfile, { user, body: { name: 'New name', phone: '9222222222' } });

    expect(result.status).toBe(200);
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.name).toBe('New name');
    expect(updated.phone).toBe('+919111111111');
  });

  it('changes the number after OTP verification, and the new number logs into the same account', async () => {
    const user = await makeUser({ phone: '+919111111111', firebaseUid: 'uid-a' });

    const result = await call(changePhone, { user, body: { idToken: token('uid-a', '+919222222222') } });

    expect(result.status).toBe(200);
    expect(result.body.user.phone).toBe('+919222222222');
    const again = await login(token('uid-a', '+919222222222'));
    expect(again.body.safeUser.id).toBe(user.id);
    expect(await prisma.user.count()).toBe(1);
  });

  it("refuses a number that belongs to another account, leaving both unchanged", async () => {
    const user = await makeUser({ phone: '+919111111111', firebaseUid: 'uid-a' });
    await makeUser({ phone: '+919222222222' });

    const result = await call(changePhone, { user, body: { idToken: token('uid-a', '+919222222222') } });

    expect(result.status).toBe(409);
    expect(result.body.code).toBe('PHONE_IN_USE');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).phone).toBe('+919111111111');
  });

  it("refuses another person's verification token", async () => {
    const user = await makeUser({ phone: '+919111111111', firebaseUid: 'uid-a' });

    const result = await call(changePhone, { user, body: { idToken: token('uid-b', '+919333333333') } });

    expect(result.status).toBe(403);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).phone).toBe('+919111111111');
  });

  it("picks up a verified change that never reached us, on the user's next login", async () => {
    const user = await makeUser({ phone: '+919111111111', firebaseUid: 'uid-a' });

    const result = await login(token('uid-a', '+919222222222'));

    expect(result.body.safeUser.id).toBe(user.id);
    expect(result.body.safeUser.phone).toBe('+919222222222');
  });
});

describe('database rules', () => {
  it.each(['9876543210', '+9198765', '+911234567890', '919876543210'])('rejects the phone format %s', async (phone) => {
    await expect(makeUser({ phone })).rejects.toThrow();
  });

  it('rejects a user with no phone', async () => {
    await expect(prisma.$executeRaw`INSERT INTO "User" (id, "firebaseUid", "updatedAt") VALUES ('x', 'y', now())`).rejects.toThrow();
  });

  it('rejects two accounts with the same phone', async () => {
    await makeUser({ phone: '+919111111111' });
    await expect(makeUser({ phone: '+919111111111' })).rejects.toThrow();
  });
});
