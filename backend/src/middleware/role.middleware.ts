import { Role } from "@prisma/client";
import { Request, Response,NextFunction } from "express";

export const restrictTo = (...roles : Role[]) => {
    return (req : Request , res : Response , next : NextFunction) : void => {
        if(!req.user){
            res.status(401).json({
                success : false,
                message : "Authentication required. Please log in."
            });
            return;
        }

        if(!roles.includes(req.user.role)){
            res.status(403).json({
                success : false,
                message : "Forbidden : you do not have the required permission."
            });
            return;
        }
        next();
    }
}