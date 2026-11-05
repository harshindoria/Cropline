import { Prisma } from '@prisma/client';
import prisma from '../src/config/db';

let sequence = 0;

export const resetDatabase = () =>
  prisma.$executeRaw`TRUNCATE "User", "CropCatalog", "PlatformSettings" CASCADE`;

export const makeUser = (data: Partial<Prisma.UserUncheckedCreateInput> = {}) => {
  const n = ++sequence;
  return prisma.user.create({ data: { firebaseUid: `uid-${n}`, phone: `+91${6000000000 + n}`, ...data } });
};
