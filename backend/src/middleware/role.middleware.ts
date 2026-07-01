import { Role, RoleAccessStatus } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import prisma from '../config/db';

export const restrictTo = (...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Authentication required.' });
      return;
    }
    if (!roles.includes(req.user.activeRole)) {
      res.status(403).json({ success: false, code: 'WRONG_WORKSPACE', message: 'Switch to the required workspace first.' });
      return;
    }
    next();
  };

// Use only on actions that begin new commercial work. Existing-work routes
// deliberately omit this middleware so blocked users can finish commitments.
export const requireRoleOperational = (role: Role) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user || req.user.activeRole !== role) {
      res.status(403).json({ success: false, code: 'WRONG_WORKSPACE', message: 'Switch to the required workspace first.' });
      return;
    }

    const access = await prisma.userRoleAccess.findUnique({
      where: { userId_role: { userId: req.user.id, role } },
    });
    if (!access) {
      res.status(403).json({ success: false, code: 'ROLE_NOT_ONBOARDED', role, message: 'Complete role onboarding first.' });
      return;
    }

    if (access.status === RoleAccessStatus.BLOCKED) {
      if (access.blockedUntil && access.blockedUntil <= new Date()) {
        await prisma.userRoleAccess.update({
          where: { id: access.id },
          data: { status: RoleAccessStatus.ACTIVE, reason: null, blockedAt: null, blockedUntil: null, blockedByAdminId: null },
        });
      } else {
        res.status(403).json({
          success: false, code: 'ROLE_BLOCKED', role, reason: access.reason,
          blockedUntil: access.blockedUntil, message: `${role} operations are blocked.`,
        });
        return;
      }
    }
    next();
  };
