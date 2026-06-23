import { firebaseAuth } from "../config/firebase";

export const verifyFirebaseToken = async (idToken: string) => {
    try {
        const decodedToken = await firebaseAuth.verifyIdToken(idToken);
        
        // Seedha object return kar rahe hain
        return {
            uid: decodedToken.uid,
            phoneNumber: decodedToken.phone_number
        };
    } catch (error) {
        // Original error ko terminal mein print karna taaki debug karna aasan ho
        console.error("Firebase Token Verification Error:", error);
        throw new Error('Invalid or expired Firebase ID token');
    }
}