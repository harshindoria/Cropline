import { Request, Response } from 'express';
import prisma from '../config/db';
import { z } from 'zod';
import { Role, RoleAccessStatus } from '@prisma/client';

export const getRoleApplications = async (req: Request, res: Response): Promise<void> => {
  try {
    const applications = await prisma.userRoleAccess.findMany({
      where: { status: RoleAccessStatus.PENDING_APPROVAL },
      include: { user: true }
    });
    res.json({ success: true, applications });
  } catch (error) {
    res.status(500).json({ success: false, message: "Could not fetch applications" });
  }
};

export const processRoleApplication = async (req: Request<{id : string}>, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // UserRoleAccess ID
    const parsed = z.object({
      action: z.enum(['APPROVE', 'REJECT']),
      reason: z.string().optional()
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, errors: parsed.error.issues });
      return;
    }

    const accessRecord = await prisma.userRoleAccess.findUnique({ where: { id } });
    if (!accessRecord) {
      res.status(404).json({ success: false, message: "Application not found" });
      return;
    }

    if (parsed.data.action === 'APPROVE') {
      await prisma.$transaction(async tx => {
        // Update UserRoleAccess
        await tx.userRoleAccess.update({
          where: { id },
          data: { status: RoleAccessStatus.ACTIVE }
        });
        // Push role to user
        const user = await tx.user.findUnique({ where: { id: accessRecord.userId } });
        if (user && !user.roles.includes(accessRecord.role)) {
          await tx.user.update({
            where: { id: accessRecord.userId },
            data: { roles: { push: accessRecord.role } }
          });
        }
      });
      res.json({ success: true, message: "Application approved" });
    } else {
      // Reject application
      await prisma.userRoleAccess.update({
        where: { id},
        data: { 
          status: RoleAccessStatus.BLOCKED, 
          reason: parsed.data.reason || 'Application rejected by Admin' 
        }
      });
      res.json({ success: true, message: "Application rejected" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error processing application" });
  }
};

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role } = req.query;
    const filter = role ? { roles: { has: role as Role } } : {};
    const users = await prisma.user.findMany({ where: filter });
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: "Could not fetch users" });
  }
};

export const deleteReview = async (req: Request<{id : string}>, res: Response): Promise<void> => {
  try {
    await prisma.review.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Review deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Could not delete review" });
  }
};

export const deleteComplaint = async (req: Request<{id : string}>, res: Response): Promise<void> => {
  try {
    await prisma.complaint.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Complaint deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Could not delete complaint" });
  }
};

export const processWithdrawalRequest = async (req: Request, res: Response): Promise<void> => {
  // Placeholder for future manual withdrawal processing
  res.json({ success: true, message: "Withdrawal processed manually" });
};
