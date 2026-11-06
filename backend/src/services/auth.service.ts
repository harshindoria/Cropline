import { Prisma, Role, User } from "@prisma/client";
import prisma from "../config/db";
import { firebaseAuth } from "../config/firebase";

export class FirebaseTokenError extends Error {
    constructor(message = 'Invalid or expired Firebase ID token') {
        super(message);
        this.name = 'FirebaseTokenError';
        Object.setPrototypeOf(this, FirebaseTokenError.prototype);
    }
}

export class PhoneIdentityError extends Error {
    constructor(
        public readonly status: number,
        public readonly code: string,
        message: string,
    ) {
        super(message);
        this.name = 'PhoneIdentityError';
        Object.setPrototypeOf(this, PhoneIdentityError.prototype);
    }
}

export type PhoneProof = {
    uid: string;
    phoneNumber: string;
};

const VALID_PHONE = /^\+91[6-9]\d{9}$/;

const isUniqueViolation = (error: unknown): boolean =>
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const phoneInUseError = () =>
    new PhoneIdentityError(409, 'PHONE_IN_USE', 'This phone number already belongs to another account.');

const normalizeIdToken = (idToken: string): string => {
    return idToken
        .trim()
        .replace(/^Bearer\s+/i, '')
        .replace(/^["']|["']$/g, '')
        .trim();
};

/**
 * The one place that decides a phone number is verified. To switch OTP provider
 * (e.g. WhatsApp), replace this function; nothing below it needs to know.
 */
export const verifyPhoneProof = async (idToken: string): Promise<PhoneProof> => {
    let decodedToken;
    try {
        decodedToken = await firebaseAuth.verifyIdToken(normalizeIdToken(idToken));
    } catch (error) {
        console.error("Firebase Token Verification Error:", error);
        throw new FirebaseTokenError();
    }

    const phoneNumber = decodedToken.phone_number;
    if (!phoneNumber) {
        throw new PhoneIdentityError(400, 'PHONE_NOT_VERIFIED', 'This login did not verify a phone number.');
    }
    if (!VALID_PHONE.test(phoneNumber)) {
        throw new PhoneIdentityError(400, 'UNSUPPORTED_PHONE', 'Only Indian mobile numbers are supported.');
    }

    return { uid: decodedToken.uid, phoneNumber };
};

const ensureBuyerAccess = (userId: string) =>
    prisma.userRoleAccess.upsert({
        where: { userId_role: { userId, role: Role.BUYER } },
        update: {},
        create: { userId, role: Role.BUYER },
    });

const updateUserPhone = async (userId: string, phone: string): Promise<User> => {
    try {
        return await prisma.user.update({ where: { id: userId }, data: { phone } });
    } catch (error) {
        if (isUniqueViolation(error)) throw phoneInUseError();
        throw error;
    }
};

// Finds the account for a verified phone number, or creates it. Every input here comes from a
// verified token, so matching on it can't attach someone to another person's account.
export const processPhoneLogin = async ({ uid, phoneNumber: phone }: PhoneProof) => {
    let existingUser = await prisma.user.findUnique({ where: { firebaseUid: uid } });

    if (existingUser) {
        // Firebase has a newer verified number for this user, e.g. a change that never reached us.
        if (existingUser.phone !== phone) {
            existingUser = await updateUserPhone(existingUser.id, phone);
        }
        await ensureBuyerAccess(existingUser.id);
        return { user: existingUser, isNewUser: false };
    }

    const phoneUser = await prisma.user.findUnique({ where: { phone } });

    if (phoneUser) {
        const user = await prisma.user.update({ where: { phone }, data: { firebaseUid: uid } });
        await ensureBuyerAccess(user.id);
        return { user, isNewUser: false };
    }

    try {
        const newUser = await prisma.user.create({
            data: {
                phone,
                firebaseUid: uid,
                activeRole: Role.BUYER,
                roleAccess: { create: { role: Role.BUYER } },
            },
        });
        return { user: newUser, isNewUser: true };
    } catch (error) {
        if (!isUniqueViolation(error)) throw error;

        // Two first logins raced and the other one won; the database kept it to one account.
        const winner = await prisma.user.findUnique({ where: { phone } });
        if (!winner) throw error;
        return { user: winner, isNewUser: true };
    }
};

// Applies a phone change the user has already confirmed by OTP on the new number.
export const changeVerifiedPhone = async (user: User, proof: PhoneProof): Promise<User> => {
    if (proof.uid !== user.firebaseUid) {
        throw new PhoneIdentityError(403, 'WRONG_ACCOUNT', 'This verification belongs to a different account.');
    }
    if (proof.phoneNumber === user.phone) {
        return user;
    }
    return updateUserPhone(user.id, proof.phoneNumber);
};
