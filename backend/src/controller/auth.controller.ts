import {Request, Response} from 'express';
import {
    changeVerifiedPhone,
    FirebaseTokenError,
    PhoneIdentityError,
    processPhoneLogin,
    verifyPhoneProof,
} from '../services/auth.service';
import { sanitizeUser } from '../utils/helper';
import { signToken } from '../utils/jwtUtils';
import { loadAccount } from '../utils/roles';

const isFirebaseTokenError = (error: unknown): error is FirebaseTokenError => {
    return error instanceof FirebaseTokenError || (error as Error)?.name === 'FirebaseTokenError';
};

const getErrorMessage = (error: unknown): string => {
    return error instanceof Error ? error.message : 'Unknown error';
};

const sendAuthError = (res: Response, error: unknown): void => {
    if (isFirebaseTokenError(error)) {
        res.status(401).json({ success: false, message: error.message });
        return;
    }
    if (error instanceof PhoneIdentityError) {
        res.status(error.status).json({ success: false, code: error.code, message: error.message });
        return;
    }
    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? "Internal server error during login" : getErrorMessage(error)
    });
};

export const loginWithPhone = async (req : Request, res : Response) : Promise<void> => {
    try {
        const {idToken} = req.body;
        if(!idToken){
            res.status(400).json({
                success : false,
                error : "idToken is required"
            });
            return;
        }

        // Controller sirf request lega aur service ko pass karega
        const proof = await verifyPhoneProof(idToken);
        const {user, isNewUser} = await processPhoneLogin(proof);
        const userWithRoles = await loadAccount(user);
        const safeUser = sanitizeUser(userWithRoles);
        const token = signToken(user.id, userWithRoles.roles, user.activeRole);
        res.status(200).json({
            success : true,
            safeUser,
            token,
            isNewUser
        })
    } catch (error) {
        console.error("Login Error:", error);
        sendAuthError(res, error);
    }
}

// The user has already confirmed an OTP on the new number; the refreshed token proves it.
export const changePhone = async (req : Request, res : Response) : Promise<void> => {
    try {
        const {idToken} = req.body;
        if(!idToken){
            res.status(400).json({ success : false, message : "idToken is required" });
            return;
        }

        const proof = await verifyPhoneProof(idToken);
        const user = await changeVerifiedPhone(req.user!, proof);
        res.status(200).json({ success : true, user : sanitizeUser(await loadAccount(user)) });
    } catch (error) {
        console.error("Change Phone Error:", error);
        sendAuthError(res, error);
    }
}
