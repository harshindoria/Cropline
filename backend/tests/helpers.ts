import { CropCategory, Prisma, Role } from '@prisma/client';
import prisma from '../src/config/db';
import { encryptField } from '../src/utils/fieldEncryption';
import { loadAccount } from '../src/utils/roles';

let sequence = 0;

export const resetDatabase = () =>
  prisma.$executeRaw`TRUNCATE "User", "CropCatalog", "PlatformSettings" CASCADE`;

type MakeUser = Partial<Prisma.UserUncheckedCreateInput> & {
  roles?: Role[];
  bankAccount?: string;
  bankIfsc?: string;
  bankName?: string;
  accountHolderName?: string;
};

export const makeUser = async ({
  roles = [Role.BUYER],
  bankAccount,
  bankIfsc,
  bankName,
  accountHolderName,
  ...data
}: MakeUser = {}) => {
  const n = ++sequence;
  const user = await prisma.user.create({
    data: {
      firebaseUid: `uid-${n}`,
      phone: `+91${6000000000 + n}`,
      ...data,
      roleAccess: { create: roles.map((role) => ({ role })) },
      ...(bankAccount && {
        bankDetails: { create: { bankAccount: encryptField(bankAccount), bankIfsc, bankName, accountHolderName } },
      }),
    },
  });
  return loadAccount(user);
};

export const makeCatalog = () =>
  prisma.cropCatalog.upsert({
    where: { englishName: 'Potato' },
    update: {},
    create: { englishName: 'Potato', hindiName: 'Aloo', category: CropCategory.VEGETABLES },
  });
