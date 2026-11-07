import { Request, Response } from 'express';
import prisma from '../config/db';
import { UnknownCropError, primaryCropsRelation, primaryCropsSelect, primaryCropsText } from '../utils/primaryCrops';
import { sanitizeUser } from '../utils/helper';
import { z } from 'zod';
import { Role, RoleAccessStatus, UnbanFeeStatus } from '@prisma/client';
import { signToken } from '../utils/jwtUtils';
import { HELD_ROLE_STATUSES, hasRole, loadAccount } from '../utils/roles';
import { encryptField } from '../utils/fieldEncryption';

// 💡 Zod Schema (Updated to include bank and aadhaar)
const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
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
  // Forms send "2000-05-06" or a full ISO date, and the database client needs a real Date.
  dob: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date of birth.')
    .refine((value) => Date.parse(value) <= Date.now(), 'Date of birth cannot be in the future.')
    .transform((value) => new Date(value))
    .optional(),
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
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user && loadAccount(user);
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

const pick = <K extends string>(data: Record<string, unknown>, keys: readonly K[]) =>
  Object.fromEntries(keys.filter((key) => data[key] !== undefined).map((key) => [key, data[key]])) as Partial<Record<K, any>>;

const FARMER_FIELDS = ['farmArea', 'farmingType', 'soilType', 'waterSource'] as const;
const DELIVERY_FIELDS = ['vehicleType', 'vehicleNumber', 'vehicleColor', 'coverageRadiusKm'] as const;
const BANK_FIELDS = ['bankIfsc', 'bankName', 'accountHolderName'] as const;
const KYC_FIELDS = ['aadhaarLast4'] as const;
const KYC_DOCUMENTS = ['aadhaarUrl', 'dlUrl', 'rcUrl'] as const;
const ACCOUNT_FIELDS: readonly string[] = ['primaryCrops', ...FARMER_FIELDS, ...DELIVERY_FIELDS, ...BANK_FIELDS, ...KYC_FIELDS, ...KYC_DOCUMENTS, 'bankAccount'];

// An empty value means the user removed the document.
const encryptedOrNull = (value: string) => (value ? encryptField(value) : null);

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
            message: validation.error.issues[0].message,
            details: validation.error.format() // Exact batayega kahan galti hui
        });
        return;
    }

    // validation.data mein ab sirf safe, verified, aur stripped fields hain!
    const safeUpdateData = validation.data;
    
    // Database mein update karein
    const farmer = pick(safeUpdateData, FARMER_FIELDS);
    const delivery = pick(safeUpdateData, DELIVERY_FIELDS);
    const bank = {
        ...pick(safeUpdateData, BANK_FIELDS),
        ...(safeUpdateData.bankAccount !== undefined && { bankAccount: encryptField(safeUpdateData.bankAccount) }),
    };
    const kyc = {
        ...pick(safeUpdateData, KYC_FIELDS),
        ...Object.fromEntries(
            KYC_DOCUMENTS.filter((key) => safeUpdateData[key] !== undefined).flatMap((key) => [
                [key, encryptedOrNull(safeUpdateData[key]!)],
                // Nobody has checked a new document, so an earlier approval no longer applies.
                [key.replace('Url', 'Verified'), false],
            ]),
        ),
    };
    const userFields = {
        ...Object.fromEntries(Object.entries(safeUpdateData).filter(([key]) => !ACCOUNT_FIELDS.includes(key))),
        ...(safeUpdateData.aadhaarUrl !== undefined && { isVerified: false }),
    };

    const updatedUser = await prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({ where: { id: userId }, data: userFields });
        if (Object.keys(farmer).length || safeUpdateData.primaryCrops !== undefined) {
            const crops = safeUpdateData.primaryCrops !== undefined
                ? { primaryCrops: await primaryCropsRelation(tx, safeUpdateData.primaryCrops) }
                : {};
            await tx.farmerProfile.upsert({
                where: { userId },
                create: { userId, ...farmer, ...(crops.primaryCrops && { primaryCrops: { connect: crops.primaryCrops.set } }) },
                update: { ...farmer, ...crops },
            });
        }
        if (Object.keys(delivery).length) {
            await tx.deliveryProfile.upsert({ where: { userId }, create: { userId, ...delivery }, update: delivery });
        }
        if (Object.keys(bank).length) {
            await tx.bankDetails.upsert({ where: { userId }, create: { userId, ...bank }, update: bank });
        }
        if (Object.keys(kyc).length) {
            await tx.kycDocuments.upsert({ where: { userId }, create: { userId, ...kyc }, update: kyc });
        }
        return updated;
    });
    
    // Naya data wapas bhejein, par sanitize karke!
    res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        user: sanitizeUser(await loadAccount(updatedUser))
    });
    
  } catch (error: any) {
     if (error instanceof UnknownCropError) {
         res.status(400).json({ success: false, code: 'UNKNOWN_CROP', message: error.message });
         return;
     }
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
  const updated = await prisma.user.update({ where: { id: req.user.id }, data: { activeRole: parsed.data.role } });
  const user = await loadAccount(updated);
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

  // Applying again would take away a role the user already holds, including a blocked one.
  if (existingAccess && HELD_ROLE_STATUSES.includes(existingAccess.status)) {
    res.status(409).json({ success: false, message: 'You already have this role.' });
    return;
  }

  let access;
  try {
  access = await prisma.$transaction(async tx => {
    const userId = req.user!.id;
    if (parsed.data.vehicleType) {
      const delivery = { vehicleType: parsed.data.vehicleType };
      await tx.deliveryProfile.upsert({ where: { userId }, create: { userId, ...delivery }, update: delivery });
    }
    if (parsed.data.role === Role.FARMER) {
      const { primaryCrops, farmingType, soilType, waterSource } = parsed.data;
      const crops = primaryCrops ? await primaryCropsRelation(tx, primaryCrops) : undefined;
      const farmer = {
        ...(farmingType && { farmingType }),
        ...(soilType && { soilType }),
        ...(waterSource && { waterSource }),
      };
      await tx.farmerProfile.upsert({
        where: { userId },
        create: { userId, ...farmer, ...(crops && { primaryCrops: { connect: crops.set } }) },
        update: { ...farmer, ...(crops && { primaryCrops: crops }) },
      });
    }

    return tx.userRoleAccess.upsert({
      where: { userId_role: { userId: req.user!.id, role: parsed.data.role } }, 
      update: { status: RoleAccessStatus.PENDING_APPROVAL, changedByAdminId: null },
      create: { userId: req.user!.id, role: parsed.data.role, status: RoleAccessStatus.PENDING_APPROVAL },
    });
  });
  } catch (error) {
    if (error instanceof UnknownCropError) { res.status(400).json({ success: false, code: 'UNKNOWN_CROP', message: error.message }); return; }
    throw error;
  }
  
  // The role is only held once an admin approves the application.
  const user = await getCurrentUser(req.user!.id);
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
  // Only a role the user already holds can be blocked or unblocked, so this can never grant one.
  const existing = await prisma.userRoleAccess.findFirst({
    where: { userId: parsed.data.userId, role: parsed.data.role, status: { in: HELD_ROLE_STATUSES } },
  });
  if (!existing) {
    res.status(404).json({ success: false, code: 'ROLE_NOT_HELD', message: 'This user does not have this role.' });
    return;
  }
  const access = await prisma.userRoleAccess.update({
    where: { id: existing.id },
    data: parsed.data.blocked ? {
      status: RoleAccessStatus.BLOCKED, reason: parsed.data.reason, blockedAt: new Date(),
      blockedUntil: parsed.data.blockedUntil, changedByAdminId: req.user.id,
    } : { status: RoleAccessStatus.ACTIVE, reason: null, blockedAt: null, blockedUntil: null, changedByAdminId: req.user.id, unbanFeeStatus: UnbanFeeStatus.NONE, unbanFeeAmount: null },
  });
  res.json({ success: true, access });
};

export const getFarmerPublicProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const farmerId = req.params.id as string;

    const farmerRow = await prisma.user.findFirst({
      where: { id: farmerId, ...hasRole('FARMER') },
      select: {
        id: true,
        name: true,
        village: true,
        district: true,
        state: true,
        rating: true,
        ratingCount: true,
        aboutMe: true,
        createdAt: true,
        isVerified: true,
        phone: true,
        email: true,
        farmerProfile: { select: { farmArea: true, primaryCrops: primaryCropsSelect, farmingType: true, soilType: true, waterSource: true } },
      }
    });

    if (!farmerRow) {
      res.status(404).json({ success: false, message: 'Farmer not found' });
      return;
    }

    const { farmerProfile, ...farmerDetails } = farmerRow;
    const farmer = { ...farmerDetails, ...farmerProfile, primaryCrops: primaryCropsText(farmerProfile?.primaryCrops) };

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
    const { isOnline, latitude, longitude } = req.body; // Expect boolean
    
    if (typeof isOnline !== 'boolean') {
      res.status(400).json({ success: false, message: 'isOnline must be a boolean' });
      return;
    }

    const hasNewLocation =
      typeof latitude === 'number' && Math.abs(latitude) <= 90 && typeof longitude === 'number' && Math.abs(longitude) <= 180;

    // Offers go out by distance, so a partner with no location could never receive one.
    if (isOnline && !hasNewLocation && (req.user!.latitude === null || req.user!.longitude === null)) {
      res.status(400).json({ success: false, code: 'LOCATION_REQUIRED', message: 'Please allow location access to go online.' });
      return;
    }

    if (hasNewLocation) {
      await prisma.user.update({ where: { id: userId }, data: { latitude, longitude } });
    }

    const profile = await prisma.deliveryProfile.upsert({
      where: { userId },
      create: { userId, isOnline },
      update: { isOnline },
    });

    res.status(200).json({
      success: true,
      message: `You are now ${isOnline ? 'online' : 'offline'}`,
      data: { isOnline: profile.isOnline }
    });
  } catch (error) {
    console.error('Toggle Online Status Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update online status' });
  }
};
