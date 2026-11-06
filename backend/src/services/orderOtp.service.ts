import { OtpKind, Prisma } from '@prisma/client';
import { randomInt } from 'crypto';
import prisma from '../config/db';

const MAX_WRONG_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const newCode = () => randomInt(1000, 10000).toString();

export const newOrderOtps = (): Prisma.OrderOtpCreateWithoutOrderInput[] => [
  { kind: OtpKind.PICKUP, code: newCode() },
  { kind: OtpKind.DELIVERY, code: newCode() },
];

export type OtpCheck = 'OK' | 'INVALID' | 'LOCKED';

/** A 4-digit code is only safe if guesses are limited, so too many wrong tries lock it for a while. */
export const checkOrderOtp = async (orderId: string, kind: OtpKind, code: string): Promise<OtpCheck> => {
  const where = { orderId_kind: { orderId, kind } };
  const otp = await prisma.orderOtp.findUnique({ where });
  if (!otp) return 'INVALID';
  if (otp.lockedUntil && otp.lockedUntil > new Date()) return 'LOCKED';

  if (otp.code === code) {
    await prisma.orderOtp.update({ where, data: { wrongAttempts: 0, lockedUntil: null } });
    return 'OK';
  }

  const { wrongAttempts } = await prisma.orderOtp.update({ where, data: { wrongAttempts: { increment: 1 } } });
  if (wrongAttempts < MAX_WRONG_ATTEMPTS) return 'INVALID';

  await prisma.orderOtp.update({
    where,
    data: { wrongAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000) },
  });
  return 'LOCKED';
};

export const otpErrorMessage = (check: OtpCheck, label: string) =>
  check === 'LOCKED' ? `Too many wrong tries. Try again in ${LOCK_MINUTES} minutes.` : `Invalid ${label} OTP.`;

// The farmer hands the pickup code to the partner, and the buyer hands over the delivery code.
// Each must see only their own, or a farmer and partner could mark a delivery that never happened.
export const withVisibleOtp = <T extends { otps: { kind: OtpKind; code: string }[]; buyerId: string; farmerId: string }>(
  order: T,
  viewerId: string,
) => {
  const { otps, ...rest } = order;
  const codeFor = (kind: OtpKind) => otps.find((otp) => otp.kind === kind)?.code ?? null;
  return {
    ...rest,
    pickupOtp: viewerId === order.farmerId ? codeFor(OtpKind.PICKUP) : null,
    deliveryOtp: viewerId === order.buyerId ? codeFor(OtpKind.DELIVERY) : null,
  };
};
