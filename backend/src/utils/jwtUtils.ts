import * as jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

// Yeh hamare pass (token) ke andar ka data hai
export interface JwtPayload {
  userId: string;
  roles: Role[];
  activeRole: Role;
  exp?: number;
}

// 1. Naya Token Generate Karne Wala Function
export const signToken = (userId: string, roles: Role[], activeRole: Role): string => {
  // .env file se secret key nikalenge
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  // Token JWT_EXPIRES_IN tak valid rahega (set na ho to 30 din)
  return jwt.sign({ userId, roles, activeRole }, secret, {
    expiresIn:process.env.JWT_EXPIRES_IN as any || '30d',
  });
};

// 2. Token Check Karne Wala Function
export const verifyToken = (token: string): JwtPayload => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  // Agar token galat ya expire hoga, toh yeh line automatically error throw karegi
  return jwt.verify(token, secret) as JwtPayload;
};
