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

export const checkDeliveryLiabilityLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;

    // 1. Agar user auth nahi hai, toh next() (auth middleware ise pehle hi handle kar chuka hoga)
    if (!user) {
      return next();
    }

    // 2. Yeh rule sirf DELIVERY partners par lagoo hoga, kisaan ya buyer par nahi
    if (user.activeRole !== Role.DELIVERY) {
      next();
      return;
    }

    // 3. Threshold Limits (Aap inhe .env mein bhi rakh sakte hain)
    const LIABILITY_LIMIT_AMOUNT = 20000; // ₹20,000 max cash holding
    const LIABILITY_LIMIT_COUNT = 15;     // Max 15 unpaid COD deliveries

    // 4. Single Source of Truth Math (Live calculation)
    const [liabilitySum, liabilityCount] = await prisma.$transaction([
      // Total amount nikalo jo abhi tak reconcile (pay) nahi hua hai
      prisma.cashLiability.aggregate({
        _sum: { amount: true },
        where: {
          deliveryPartnerId: user.id,
          reconciledAt: null, 
        },
      }),
      // Total aise orders ki ginti nikalo
      prisma.cashLiability.count({
        where: {
          deliveryPartnerId: user.id,
          reconciledAt: null,
        },
      }),
    ]);

    const totalUnpaidAmount = Number(liabilitySum._sum.amount || 0);

    // 5. The Guardrail Logic (Block if limits exceeded)
    if (totalUnpaidAmount > LIABILITY_LIMIT_AMOUNT || liabilityCount > LIABILITY_LIMIT_COUNT) {
      res.status(403).json({
        success: false,
        code: 'LIABILITY_LIMIT_EXCEEDED',
        message: `System Block: You cannot accept new orders. Please settle your pending cash liability of ₹${totalUnpaidAmount} (from ${liabilityCount} orders).`,
        data: {
          pendingAmount: totalUnpaidAmount,
          pendingOrdersCount: liabilityCount
        }
      });
      return;
    }

    // 6. Agar sab clear hai, toh order uthane do
    next();

  } catch (error) {
    console.error('Liability Check Middleware Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error during liability check' 
    });
  }
};