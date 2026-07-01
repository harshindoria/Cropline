import { Request, Response } from 'express';
import prisma from '../config/db';
import { sanitizeUser } from '../utils/helper';
import { z } from 'zod';
import { Role, RoleAccessStatus } from '@prisma/client';
import { signToken } from '../utils/jwtUtils';

// 💡 Zod Schema (Updated to include bank and aadhaar)
const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  village: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  vehicleType: z.enum(['BIKE','AUTO','TEMPO','MINI_TRUCK']).optional(),
  coverageRadiusKm: z.number().int().positive().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  aadhaarLast4: z.string().length(4, "Aadhaar must be exactly 4 digits").optional(),
  bankAccount: z.string().min(5).optional(),
  bankIfsc: z.string().min(11).optional(),
});

// 1. Apna Profile Dekhne ka function
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if(!userId){
        res.status(404).json({ success: false, error: "User not found" });
        return;
    }
    
    const dbUser = await prisma.user.findUnique({ where: { id: userId } });

    if(!dbUser){
        res.status(404).json({ success: false, error: "User not found" });
        return;
    }

    const safeUser = sanitizeUser(dbUser);
    res.status(200).json({ success: true, user: safeUser });
    
  } catch (error) {
    console.error("Error in fetching user data : ", error);
    res.status(500).json({ success: false, message: "Could not fetch data" });
  }
};

// 2. Apna Profile Update karne ka function
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ success: false, error: "Unauthorized access" });
        return;
    }

    // 💡 The Zod Magic: Validate and extract at the same time
    const validation = updateProfileSchema.safeParse(req.body);

    // Agar validation fail hui (e.g., kisine string ki jagah number bhej diya)
    if (!validation.success) {
        res.status(400).json({
            success: false,
            error: "Invalid data provided",
            details: validation.error.format() // Exact batayega kahan galti hui
        });
        return;
    }

    // validation.data mein ab sirf safe, verified, aur stripped fields hain!
    const safeUpdateData = validation.data;
    
    // Database mein update karein
    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: safeUpdateData // Seedha verified object pass kar diya
    });
    
    // Naya data wapas bhejein, par sanitize karke!
    res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        user: sanitizeUser(updatedUser)
    });
    
  } catch (error) {
     console.error("Update Profile Error:", error);
     res.status(500).json({ success: false, message: "Could not update profile" });
  }
};

const workspaceRoles = [Role.BUYER, Role.FARMER, Role.DELIVERY] as const;

export const switchRole = async (req: Request, res: Response): Promise<void> => {
  const parsed = z.object({ role: z.enum(workspaceRoles) }).safeParse(req.body);
  if (!parsed.success || !req.user) {
    res.status(req.user ? 400 : 401).json({ success: false, code: req.user ? 'INVALID_ROLE' : 'AUTH_REQUIRED' });
    return;
  }
  if (!req.user.roles.includes(parsed.data.role)) {
    res.status(403).json({ success: false, code: 'ROLE_NOT_ONBOARDED', role: parsed.data.role });
    return;
  }
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { activeRole: parsed.data.role } });
  res.json({ success: true, user: sanitizeUser(user), token: signToken(user.id, user.roles, user.activeRole) });
};

export const onboardRole = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) { res.status(401).json({ success: false, code: 'AUTH_REQUIRED' }); return; }
  const parsed = z.object({
    role: z.enum([Role.FARMER, Role.DELIVERY]),
    vehicleType: z.enum(['BIKE', 'AUTO', 'TEMPO', 'MINI_TRUCK']).optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, code: 'INVALID_ONBOARDING', errors: parsed.error.issues }); return; }
  if (parsed.data.role === Role.DELIVERY && !(parsed.data.vehicleType || req.user.vehicleType)) {
    res.status(400).json({ success: false, code: 'VEHICLE_REQUIRED', message: 'A vehicle is required for delivery onboarding.' }); return;
  }

  const user = await prisma.$transaction(async tx => {
    await tx.userRoleAccess.upsert({
      where: { userId_role: { userId: req.user!.id, role: parsed.data.role } }, update: {},
      create: { userId: req.user!.id, role: parsed.data.role },
    });
    return tx.user.update({
      where: { id: req.user!.id },
      data: {
        roles: { push: req.user!.roles.includes(parsed.data.role) ? [] : parsed.data.role },
        activeRole: parsed.data.role,
        ...(parsed.data.vehicleType ? { vehicleType: parsed.data.vehicleType } : {}),
      },
    });
  });
  res.status(201).json({ success: true, user: sanitizeUser(user), token: signToken(user.id, user.roles, user.activeRole) });
};

export const setRoleBlock = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) { res.status(401).json({ success: false }); return; }
  const parsed = z.object({
    userId: z.string().min(1), role: z.enum(workspaceRoles), blocked: z.boolean(),
    reason: z.string().trim().min(3).max(500).optional(), blockedUntil: z.coerce.date().optional(),
  }).safeParse(req.body);
  if (!parsed.success || (parsed.data.blocked && !parsed.data.reason)) {
    res.status(400).json({ success: false, code: 'INVALID_ROLE_BLOCK', errors: parsed.success ? undefined : parsed.error.issues }); return;
  }
  const access = await prisma.userRoleAccess.upsert({
    where: { userId_role: { userId: parsed.data.userId, role: parsed.data.role } },
    create: { userId: parsed.data.userId, role: parsed.data.role },
    update: parsed.data.blocked ? {
      status: RoleAccessStatus.BLOCKED, reason: parsed.data.reason, blockedAt: new Date(),
      blockedUntil: parsed.data.blockedUntil, blockedByAdminId: req.user.id,
    } : { status: RoleAccessStatus.ACTIVE, reason: null, blockedAt: null, blockedUntil: null, blockedByAdminId: null },
  });
  res.json({ success: true, access });
};
