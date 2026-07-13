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

export const processPhoneLogin = async (uid: string, phone: string)  => {
    try { 
        if (!phone) {
            throw new Error("Phone number is required for Phone login");
        }

        // STEP 1: Strict UID check first (fastest path)
        let existingUser = await prisma.user.findUnique({ where: { firebaseUid: uid } });

        if (existingUser) {
            // UID found — update phone if missing
            if (!existingUser.phone) {
                existingUser = await prisma.user.update({
                    where: { id: existingUser.id },
                    data: { phone }
                });
            }
            await prisma.userRoleAccess.upsert({
                where: { userId_role: { userId: existingUser.id, role: Role.BUYER } },
                update: {},
                create: { userId: existingUser.id, role: Role.BUYER }
            });
            return { user: existingUser, isNewUser: false };
        }

        // STEP 2: No UID match — check if this phone belongs to an existing account
        const phoneUser = await prisma.user.findUnique({ where: { phone } });

        if (phoneUser) {
            // Link this Firebase UID to the existing phone-based account
            existingUser = await prisma.user.update({
                where: { phone },
                data: { firebaseUid: uid }
            });
            await prisma.userRoleAccess.upsert({
                where: { userId_role: { userId: existingUser.id, role: Role.BUYER } },
                update: {},
                create: { userId: existingUser.id, role: Role.BUYER }
            });
            return { user: existingUser, isNewUser: false };
        }

        // STEP 3: Completely new user — create fresh account
        const newUser = await prisma.user.create({ 
            data: {
                phone, 
                firebaseUid: uid, 
                roles: [Role.BUYER], 
                activeRole: Role.BUYER,
                roleAccess: { create: { role: Role.BUYER } }
            }
        });
        
        return { user: newUser, isNewUser: true };

    } catch (error) {
        console.error("Database Sync Error:", error);
        throw new Error(error instanceof Error ? error.message : "Could not process user in database");
    }
}

export const processGoogleLogin = async (uid: string, email: string) => {
    try {
        if (!email) {
            throw new Error("Email is required for Google login");
        }

        // STEP 1: Strict UID check
        let existingUser = await prisma.user.findUnique({ where: { firebaseUid: uid } });

        if (existingUser) {
            // UID found — update email if missing
            if (!existingUser.email) {
                existingUser = await prisma.user.update({
                    where: { id: existingUser.id },
                    data: { email }
                });
            }
            await prisma.userRoleAccess.upsert({ 
                where: { userId_role: { userId: existingUser.id, role: Role.BUYER } }, 
                update: {}, 
                create: { userId: existingUser.id, role: Role.BUYER } 
            });
            return { user: existingUser, isNewUser: false };
        }

        // STEP 2: No UID match — check if this email belongs to an existing account
        const emailUser = await prisma.user.findUnique({ where: { email } });

        if (emailUser) {
            // Link this Firebase UID to the existing email-based account
            existingUser = await prisma.user.update({
                where: { email }, 
                data: { firebaseUid: uid }      
            });
            await prisma.userRoleAccess.upsert({ 
                where: { userId_role: { userId: existingUser.id, role: Role.BUYER } }, 
                update: {}, 
                create: { userId: existingUser.id, role: Role.BUYER } 
            });
            return { user: existingUser, isNewUser: false };
        }

        // STEP 3: Completely new user
        const newUser = await prisma.user.create({ 
            data: {
                email, 
                firebaseUid: uid, 
                roles: [Role.BUYER], 
                activeRole: Role.BUYER,
                roleAccess: { create: { role: Role.BUYER } }
            }
        });

        return { user: newUser, isNewUser: true };

    } catch (error) {
        console.error("Database Sync Error:", error);
        throw new Error(error instanceof Error ? error.message : "Could not process user in database");
    }
}


export const verifyFirebaseToken = async (idToken: string) => {
    try {
        const decodedToken = await firebaseAuth.verifyIdToken(normalizeIdToken(idToken));
        return {
            uid: decodedToken.uid,
            phoneNumber: decodedToken.phone_number,
            email: decodedToken.email
        };
    } catch (error) {
        console.error("Firebase Token Verification Error:", error);
        throw new FirebaseTokenError();
    }
}