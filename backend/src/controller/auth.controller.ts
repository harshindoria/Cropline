import {Request, Response} from 'express';
import { verifyFirebaseToken } from '../services/auth.service';
import prisma from '../config/db';


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

        if(!role){
            res.status(400).json({
                success : false,
                error : "Role is required"
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

        let user = await prisma.user.findUnique({where : {phone : userPhoneNumber}});

        if(!user){
            user = await prisma.user.create({data : {
                phone : userPhoneNumber,
                role : role,
                firebaseUid : userId
            }});
        }   
        res.status(200).json({
            success : true,
            user,
            token : "dummy_token"
        })
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error during login"
        });
    }
}