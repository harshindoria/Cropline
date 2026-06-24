import { Request, Response } from 'express';
import prisma from '../config/db';

// 1. Apna Profile Dekhne ka function
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    // 💡 Hint 1: Token se aayi ID ka use karein
    const userId = req.user?.id;
    if(!userId){
        res.status(404).json({
            sucess : false,
            error : "User not found"
        })
        return;
    }
    
    // 💡 Hint 2: Database se user dhoondhein
    const dbUser = await prisma.user.findUnique({where : {id : userId}});

    
    // 💡 Hint 3: Data wapas bhejein
    if(!dbUser){
        res.status(404).json({
            success : false,
            error : "User not found"
        });
        return;
    }
    res.status(200).json({
        success : true,
        user : dbUser
    });
    
  } catch (error) {
    // 💡 Hint 4: Error Handle karein
    console.error("Error in fetching user data : ",error);
    res.status(500).json({
        success : false,
        message : "Could not fetch data"
    });
  }
};

// 2. Apna Profile Update karne ka function
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: "Unauthorized access"
        });
        return;
    }

    // 💡 Hint 5: Request body se sirf safe data nikalein (Security Filter)
    // Hum deliberately 'role', 'phone', 'walletBalance', 'firebaseUid' ko yahan nahi nikal rahe hain
    const {
        name,
        aadhaarLast4,
        latitude,
        longitude,
        village,
        district,
        state,
        pincode,
        vehicleType,
        coverageRadiusKm,
        bankAccount,
        bankIfsc
    } = req.body;
    
    // 💡 Hint 6: Database mein update karein
    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
            // Prisma will automatically ignore any fields that are 'undefined'
            name,
            aadhaarLast4,
            latitude,
            longitude,
            village,
            district,
            state,
            pincode,
            vehicleType,
            coverageRadiusKm,
            bankAccount,
            bankIfsc
        }
    });
    
    // 💡 Hint 7: Naya data wapas bhejein
    res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        user: updatedUser
    });
    
  } catch (error) {
     console.error("Update Profile Error:", error);
     res.status(500).json({ 
         success: false, 
         message: "Could not update profile" 
     });
  }
};