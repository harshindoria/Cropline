import { Prisma, Role } from '@prisma/client';
import prisma from '../src/config/db';
import { attachRoles } from '../src/utils/roles';

let sequence = 0;

export const resetDatabase = () =>
  prisma.$executeRaw`TRUNCATE "User", "CropCatalog", "PlatformSettings" CASCADE`;

export const makeUser = async ({
  roles = [Role.BUYER],
  ...data
}: Partial<Prisma.UserUncheckedCreateInput> & { roles?: Role[] } = {}) => {
  const n = ++sequence;
  const user = await prisma.user.create({
    data: {
      firebaseUid: `uid-${n}`,
      phone: `+91${6000000000 + n}`,
      ...data,
      roleAccess: { create: roles.map((role) => ({ role })) },
    },
  });
  return attachRoles(user);
};
