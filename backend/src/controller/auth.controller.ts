import {Request, Response} from 'express';
import { FirebaseTokenError, sanitizeUser, verifyFirebaseToken } from '../services/auth.service';
import prisma from '../config/db';
import { signToken } from '../utils/jwtUtils';
import { Role } from '@prisma/client';
import { processPhoneLogin } from '../services/auth.service';


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
        if(!role || !allowedSignupRoles.includes(role as Role)){
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

        // Controller sirf request lega aur service ko pass karega
        const {user, isNewUser} = await processPhoneLogin(userId, userPhoneNumber, role);
        const safeUser = sanitizeUser(user);
        // Agar pehli baar mein UID se mil gaya tha, toh code seedha yahan aayega 
        // aur bina kisi extra database call ke aage badh jayega!
        const token = signToken(user.id, user.role);
        res.status(200).json({
            success : true,
            safeUser,
            token,
            isNewUser
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


export const loginWithEmail = async (req : Request , res : Response) => {
    
}