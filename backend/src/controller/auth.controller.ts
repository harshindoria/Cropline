import {Request, Response} from 'express';
import { FirebaseTokenError, verifyFirebaseToken } from '../services/auth.service';
import prisma from '../config/db';
import { signToken } from '../utils/jwtUtils';
import { Role } from '@prisma/client';


export const loginWithPhone = async (req : Request, res : Response) : Promise<void> => {
    try {
        const {idToken, role} = req.body;
        if(!idToken){
            res.status(400).json({
                success : false,
                error : "idToken is required"
            });
            return;
        }
        const allowedSignupRoles: Role[] = [Role.FARMER, Role.BUYER, Role.DELIVERY];
        if(!role || !Object.values(allowedSignupRoles).includes(role as Role)){
            res.status(400).json({
                success : false,
                error : "Role is invalid"
            });
            return;
        }

        const decodedToken = await verifyFirebaseToken(idToken);
        const userPhoneNumber  = decodedToken.phoneNumber;
        const userId = decodedToken.uid;

        if (!userPhoneNumber || ! userId) {
        res.status(400).json({
                success: false,
                error: 'Invalid token!',
            });
            return;
        }

        // 1. Sabse pehle Primary Identity (Firebase UID) se dhoondhein
        let user = await prisma.user.findUnique({ where: { firebaseUid: userId } });

        // 2. Agar UID se NAHI mila, tabhi rescue mission shuru karenge
        if (!user) {
            
            // Check by Phone Number
            user = await prisma.user.findUnique({ where: { phone: userPhoneNumber } });

            if (user) {
                // Scenario A: Phone se mil gaya! Matlab UID diverge ho gaya tha. Sync karein.
                user = await prisma.user.update({
                    where: { phone: userPhoneNumber }, // Kisko update karna hai
                    data: { firebaseUid: userId }      // Kya update karna hai
                });
            } else {
                // Scenario B: Phone se bhi nahi mila! Matlab ekdum naya kisaan hai.
                user = await prisma.user.create({
                    data: {
                        phone: userPhoneNumber,
                        role: role, // (Dhyan rahe, yahan allowedRoles wala array check zaroor lagayein jo pehle discuss hua tha)
                        firebaseUid: userId
                    }
                });
            }
        }

        // Agar pehli baar mein UID se mil gaya tha, toh code seedha yahan aayega 
        // aur bina kisi extra database call ke aage badh jayega!
        const token = signToken(user.id, user.role);
        res.status(200).json({
            success : true,
            user,
            token
        })
    } catch (error) {
        console.error("Login Error:", error);
        if (error instanceof FirebaseTokenError) {
            res.status(401).json({
                success: false,
                message: error.message
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: "Internal server error during login"
        });
    }
}
