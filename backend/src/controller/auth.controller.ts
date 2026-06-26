import {Request, Response} from 'express';
import { FirebaseTokenError, processGoogleLogin, verifyFirebaseToken } from '../services/auth.service';
import { sanitizeUser } from '../utils/helper';
import { signToken } from '../utils/jwtUtils';
import { Role } from '@prisma/client';
import { processPhoneLogin } from '../services/auth.service';

const isFirebaseTokenError = (error: unknown): error is FirebaseTokenError => {
    return error instanceof FirebaseTokenError || (error as Error)?.name === 'FirebaseTokenError';
};

const getErrorMessage = (error: unknown): string => {
    return error instanceof Error ? error.message : 'Unknown error';
};

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
        const userRole = (role as Role) || Role.BUYER;
        const allowedSignupRoles: Role[] = [Role.FARMER, Role.BUYER, Role.DELIVERY];
        if(!role || !allowedSignupRoles.includes(userRole as Role)){
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
        const {user, isNewUser} = await processPhoneLogin(userId, userPhoneNumber, userRole);
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
        if (isFirebaseTokenError(error)) {
            res.status(401).json({
                success: false,
                message: error.message
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: process.env.NODE_ENV === 'production' ? "Internal server error during login" : getErrorMessage(error)
        });
    }
}


export const loginWithEmail = async (req : Request , res : Response) :Promise<void> => {
    try {
        const {idToken, role} = req.body;
        if(!idToken){
            res.status(400).json({
                success : false,
                error : "idToken is required"
            });
            return;
        }
        const userRole = (role as Role) || Role.BUYER;
        const allowedSignupRoles: Role[] = [Role.FARMER, Role.BUYER, Role.DELIVERY];
        if(!role || !allowedSignupRoles.includes(userRole as Role)){
            res.status(400).json({
                success : false,
                error : "Role is invalid"
            });
            return;
        }

        const decodedToken = await verifyFirebaseToken(idToken);
        const userEmail = decodedToken.email;
        const userId = decodedToken.uid;

        if (!userEmail || !userId) {
            console.error("Invalid token");
            res.status(400).json({
                success: false,
                error: "Invalid token"
            });
            return;
        }

        const { user, isNewUser } = await processGoogleLogin(userId, userEmail, userRole);
        const safeUser = sanitizeUser(user);
        const token = signToken(user.id, user.role);

        res.status(200).json({
            success: true,
            safeUser,
            token,
            isNewUser
        });
        return;

    } catch (error) {
        console.error("Login Error:", error);
        if (isFirebaseTokenError(error)) {
            res.status(401).json({
                success: false,
                message: error.message
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: process.env.NODE_ENV === 'production' ? "Internal server error during login" : getErrorMessage(error)
        });
        return;
    }
}
