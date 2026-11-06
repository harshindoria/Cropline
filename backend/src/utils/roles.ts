import { Prisma, Role, RoleAccessStatus, User } from '@prisma/client';
import prisma from '../config/db';

// UserRoleAccess is the only record of a user's roles. A blocked user still holds the role, but
// someone who is waiting for approval or was rejected does not.
export const HELD_ROLE_STATUSES: RoleAccessStatus[] = [RoleAccessStatus.ACTIVE, RoleAccessStatus.BLOCKED];

export const hasRole = (role: Role) =>
  ({ roleAccess: { some: { role, status: { in: HELD_ROLE_STATUSES } } } }) satisfies Prisma.UserWhereInput;

export const HELD_ROLES = {
  where: { status: { in: HELD_ROLE_STATUSES } },
  orderBy: { createdAt: 'asc' },
  select: { role: true },
} satisfies Prisma.UserRoleAccessFindManyArgs;

// The API and the screens work with a plain list of roles.
export const withRoles = <T extends { roleAccess: { role: Role }[] }>(user: T) => {
  const { roleAccess, ...rest } = user;
  return { ...rest, roles: roleAccess.map((access) => access.role) };
};

export const attachRoles = async <T extends User>(user: T) => {
  const roleAccess = await prisma.userRoleAccess.findMany({ ...HELD_ROLES, where: { ...HELD_ROLES.where, userId: user.id } });
  return withRoles({ ...user, roleAccess });
};

export type UserWithRoles = User & { roles: Role[] };
