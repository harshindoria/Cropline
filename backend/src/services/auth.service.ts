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

        // STEP 1: Pehle strictly UID se check karo (The Ultimate Source of Truth)
        let existingUser = await prisma.user.findUnique({ where: { firebaseUid: uid } });

        // STEP 2: Agar UID se nahi mila, toh Phone se check karo
        if (!existingUser) {
            existingUser = await prisma.user.findUnique({ where: { phone } });
            
            if (existingUser) {
                // Account Linking (Case A): Phone number DB mein tha, par UID naya aaya hai
                existingUser = await prisma.user.update({
                    where: { phone },
                    data: { firebaseUid: uid }
                });
            }
        } else {
            // Account Linking (Case B - Your Edge Case!): 
            // Banda UID se mil gaya (matlab pehle Google se aaya tha), 
            // par DB mein uska phone number null hai. Toh update kar do!
            if (!existingUser.phone) {
                existingUser = await prisma.user.update({
                    where: { id: existingUser.id },
                    data: { phone } // Ab email aur phone dono ek hi account mein aa gaye
                });
            }
        }

        // STEP 3: Failsafe & Return (Existing User)
        if (existingUser) {
            await prisma.userRoleAccess.upsert({
                where: { userId_role: { userId: existingUser.id, role: Role.BUYER } },
                update: {}, 
                create : { userId: existingUser.id, role: Role.BUYER }
            });
            return { user: existingUser, isNewUser: false };
        }

        // STEP 4: Fresh User (Naya account)
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

        // STEP 1: Pehle strictly UID se check karo (Fastest & most accurate)
        let existingUser = await prisma.user.findUnique({ where: { firebaseUid: uid } });

        // STEP 2: Agar UID se nahi mila, toh Email se check karo 
        // (Ho sakta hai user ne pehle kisi aur tarike se sign up kiya ho aur ab Google use kar raha ho)
        if (!existingUser) {
            existingUser = await prisma.user.findUnique({ where: { email } });
            
            if (existingUser) {
                // Account Linking: Purane account mein naya Firebase UID update kar do
                existingUser = await prisma.user.update({
                    where: { email }, 
                    data: { firebaseUid: uid }      
                });
            }
        }

        // STEP 3: Agar user mil gaya (kisi bhi tarike se), toh failsafe run karo aur return karo
        if (existingUser) {
            await prisma.userRoleAccess.upsert({ 
                where: { userId_role: { userId: existingUser.id, role: Role.BUYER } }, 
                update: {}, 
                create : { userId: existingUser.id, role: Role.BUYER } 
            });
            return { user: existingUser, isNewUser: false };
        }

        // STEP 4: Agar na UID mila, na Email, matlab ekdum naya fresh user hai
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