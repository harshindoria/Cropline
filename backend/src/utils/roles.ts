import { Prisma, Role, RoleAccessStatus, User } from '@prisma/client';
import prisma from '../config/db';
import { primaryCropsSelect, primaryCropsText } from './primaryCrops';

// UserRoleAccess is the only record of a user's roles. A blocked user still holds the role, but
// someone who is waiting for approval or was rejected does not.
export const HELD_ROLE_STATUSES: RoleAccessStatus[] = [RoleAccessStatus.ACTIVE, RoleAccessStatus.BLOCKED];

export const hasRole = (role: Role) =>
  ({ roleAccess: { some: { role, status: { in: HELD_ROLE_STATUSES } } } }) satisfies Prisma.UserWhereInput;

export const HELD_ROLES = {
  where: { status: { in: HELD_ROLE_STATUSES } },
  orderBy: [{ createdAt: 'asc' }, { role: 'asc' }],
  select: { role: true },
} satisfies Prisma.UserRoleAccessFindManyArgs;

// The API and the screens work with a plain list of roles.
export const withRoles = <T extends { roleAccess: { role: Role }[] }>(user: T) => {
  const { roleAccess, ...rest } = user;
  return { ...rest, roles: roleAccess.map((access) => access.role) };
};

// The API and the screens see one flat user, wherever each field is stored. Encrypted fields stay out.
export const loadAccount = async <T extends User>(user: T) => {
  const { roleAccess, farmerProfile, deliveryProfile, bankDetails, kycDocuments } = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      roleAccess: HELD_ROLES,
      farmerProfile: { include: { primaryCrops: primaryCropsSelect } },
      deliveryProfile: true,
      bankDetails: { select: { bankIfsc: true, bankName: true, accountHolderName: true } },
      kycDocuments: {
        select: { aadhaarLast4: true, aadhaarVerified: true, dlVerified: true, rcVerified: true },
      },
    },
  });

  return {
    ...user,
    roles: roleAccess.map((access) => access.role),
    farmArea: farmerProfile?.farmArea ?? null,
    primaryCrops: farmerProfile ? primaryCropsText(farmerProfile.primaryCrops) : null,
    farmingType: farmerProfile?.farmingType ?? null,
    soilType: farmerProfile?.soilType ?? null,
    waterSource: farmerProfile?.waterSource ?? null,
    vehicleType: deliveryProfile?.vehicleType ?? null,
    vehicleNumber: deliveryProfile?.vehicleNumber ?? null,
    vehicleColor: deliveryProfile?.vehicleColor ?? null,
    coverageRadiusKm: deliveryProfile?.coverageRadiusKm ?? null,
    isOnline: deliveryProfile?.isOnline ?? false,
    dailyEarningsGoal: deliveryProfile?.dailyEarningsGoal ?? new Prisma.Decimal(2000),
    bankIfsc: bankDetails?.bankIfsc ?? null,
    bankName: bankDetails?.bankName ?? null,
    accountHolderName: bankDetails?.accountHolderName ?? null,
    aadhaarLast4: kycDocuments?.aadhaarLast4 ?? null,
    aadhaarVerified: kycDocuments?.aadhaarVerified ?? false,
    dlVerified: kycDocuments?.dlVerified ?? false,
    rcVerified: kycDocuments?.rcVerified ?? false,
  };
};

export type AccountUser = Awaited<ReturnType<typeof loadAccount<User>>>;
