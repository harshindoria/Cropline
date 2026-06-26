import { Role, User } from "@prisma/client";
import prisma from "../config/db";
import { firebaseAuth } from "../config/firebase";

export class FirebaseTokenError extends Error {
    constructor(message = 'Invalid or expired Firebase ID token') {
        super(message);
        this.name = 'FirebaseTokenError';
        Object.setPrototypeOf(this, FirebaseTokenError.prototype);
    }
}

const normalizeIdToken = (idToken: string): string => {
    return idToken
        .trim()
        .replace(/^Bearer\s+/i, '')
        .replace(/^["']|["']$/g, '')
        .trim();
};

export const processPhoneLogin = async (uid: string, phone: string, role: Role)  => {
    try { 
        // Shorthand: { phone } is same as { phone: phone }
        const existingUser = await prisma.user.findUnique({ where: { phone } });
        
        if (existingUser) {
            // (Optional Security Check): Agar kal ko user Firebase account delete karke 
            // same number se wapas aaye, toh naya UID milega. Yahan check karna acha hota hai.
            if (existingUser.firebaseUid !== uid) {
                // UID update kar do agar change hua hai
                await prisma.user.update({
                    where: { phone },
                    data: { firebaseUid: uid }
                });
            }
            return {user : existingUser, isNewUser : false};
        }

        // Shorthand applied here too
        const newUser = await prisma.user.create({
            data: {
                phone,
                firebaseUid: uid,
                role
            }
        });
        
        return {user : newUser, isNewUser : true};

    } catch (error) {
        console.error("Database Sync Error:", error);
        throw new Error(error instanceof Error ? error.message : "Could not process user in database");
    }
}

export const verifyFirebaseToken = async (idToken: string) => {
    try {
        const decodedToken = await firebaseAuth.verifyIdToken(normalizeIdToken(idToken));
        
        // Seedha object return kar rahe hain
        return {
            uid: decodedToken.uid,
            phoneNumber: decodedToken.phone_number,
            email : decodedToken.email
        };
    } catch (error) {
        // Original error ko terminal mein print karna taaki debug karna aasan ho
        console.error("Firebase Token Verification Error:", error);
        throw new FirebaseTokenError();
    }
}

export const processGoogleLogin = async (uid: string, email: string, role: Role) => {
    try {
        if (!email) {
            throw new Error("Email is required for Google login");
        }
        let existingUser = await prisma.user.findUnique({ where: { firebaseUid: uid } });

        if (existingUser) {
            return { user: existingUser, isNewUser: false };
        }

        // Shorthand: { email } ki jagah { email: email }
        existingUser = await prisma.user.findUnique({ where: { email } });

        if (existingUser) {
            const updatedUser = await prisma.user.update({
                where: { email }, 
                data: { firebaseUid: uid }      
            });
            return { user: updatedUser, isNewUser: false };
        }

        // Shorthand applied here too
        const newUser = await prisma.user.create({
            data: {
                email,
                firebaseUid: uid,
                role
            }
        });

        return { user: newUser, isNewUser: true };

    } catch (error) {
        console.error("Database Sync Error:", error);
        throw new Error(error instanceof Error ? error.message : "Could not process user in database");
    }
}
