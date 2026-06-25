import { Request, Response } from 'express';
import prisma from '../config/db';
import { sanitizeUser } from '../services/auth.service';
import { z } from 'zod';

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