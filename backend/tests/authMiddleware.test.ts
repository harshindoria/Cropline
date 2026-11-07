import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import prisma from '../src/config/db';
import { protect } from '../src/middleware/auth.middleware';
import { signToken } from '../src/utils/jwtUtils';
import { makeUser, resetDatabase } from './helpers';

const runProtect = async (token?: string) => {
  let status = 200;
  let body: any;
  let passed = false;
  const req: any = { headers: token ? { authorization: `Bearer ${token}` } : {} };
  const res: any = {
    status(code: number) {
      status = code;
      return this;
    },
    json(data: unknown) {
      body = data;
      return this;
    },
  };
  await protect(req, res, () => {
    passed = true;
  });
  return { status, body, passed, req };
};

describe('protect middleware', () => {
  beforeEach(resetDatabase);
  afterEach(() => vi.restoreAllMocks());
  afterAll(() => prisma.$disconnect());

  it('lets a valid token through and attaches the user', async () => {
    const user = await makeUser({ phone: '+919876500001' });
    const result = await runProtect(signToken(user.id, [Role.BUYER], Role.BUYER));
    expect(result.passed).toBe(true);
    expect(result.req.user.id).toBe(user.id);
  });

  it('ends the session for a forged token', async () => {
    const result = await runProtect('not-a-real-token');
    expect(result).toMatchObject({ status: 401, passed: false, body: { code: 'SESSION_INVALID' } });
  });

  it('ends the session for an expired token', async () => {
    const user = await makeUser({ phone: '+919876500002' });
    const expired = jwt.sign({ userId: user.id, exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET!);
    const result = await runProtect(expired);
    expect(result).toMatchObject({ status: 401, body: { code: 'SESSION_INVALID' } });
  });

  it('ends the session when the account no longer exists', async () => {
    const result = await runProtect(signToken('00000000-0000-0000-0000-000000000000', [Role.BUYER], Role.BUYER));
    expect(result).toMatchObject({ status: 401, body: { code: 'SESSION_INVALID' } });
  });

  it('keeps the session when the database fails, so the app does not log the user out', async () => {
    const user = await makeUser({ phone: '+919876500003' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(prisma.user, 'findUnique').mockRejectedValueOnce(new Error('connection lost'));
    const result = await runProtect(signToken(user.id, [Role.BUYER], Role.BUYER));
    expect(result.status).toBe(500);
    expect(result.body.code).toBeUndefined();
    expect(result.passed).toBe(false);
  });
});
