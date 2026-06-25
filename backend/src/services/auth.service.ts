import { firebaseAuth } from "../config/firebase";

export class FirebaseTokenError extends Error {
    constructor(message = 'Invalid or expired Firebase ID token') {
        super(message);
        this.name = 'FirebaseTokenError';
    }
}

const normalizeIdToken = (idToken: string): string => {
    return idToken
        .trim()
        .replace(/^Bearer\s+/i, '')
        .replace(/^["']|["']$/g, '')
        .trim();
};

export const verifyFirebaseToken = async (idToken: string) => {
    try {
        const decodedToken = await firebaseAuth.verifyIdToken(normalizeIdToken(idToken));
        
        // Seedha object return kar rahe hain
        return {
            uid: decodedToken.uid,
            phoneNumber: decodedToken.phone_number
        };
    } catch (error) {
        // Original error ko terminal mein print karna taaki debug karna aasan ho
        console.error("Firebase Token Verification Error:", error);
        throw new FirebaseTokenError();
    }
}
