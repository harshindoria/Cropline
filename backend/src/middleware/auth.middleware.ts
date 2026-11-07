import { Request, Response, NextFunction } from 'express';
import { JsonWebTokenError } from 'jsonwebtoken';
import { verifyToken } from '../utils/jwtUtils';
import prisma from '../config/db';
import { Role } from '@prisma/client';
import { AccountUser, loadAccount } from '../utils/roles';

// Extending Express Request to attach the authenticated user object
declare global {
  namespace Express {
    interface Request {
      user?: AccountUser; 
    }
  }
}

export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // 1. Extract the token from the Authorization header
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1]; 
    }

    if (!token) {
      res.status(401).json({ 
        success: false, 
        message: 'Unauthorized access. Please log in to continue.' 
      });
      return;
    }

    // 2. Verify the token cryptographically. Only a bad or expired token means the session is over.
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      if (!(error instanceof JsonWebTokenError)) throw error;
      res.status(401).json({
        success: false,
        code: 'SESSION_INVALID',
        message: 'Invalid or expired token. Please log in again.'
      });
      return;
    }

    // 3. Verify if the user still exists in the database
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!currentUser) {
      res.status(401).json({
        success: false,
        code: 'SESSION_INVALID',
        message: 'The user belonging to this token no longer exists.'
      });
      return;
    }

    // 4. Check if the user account is active (not suspended or banned)
    if (!currentUser.isActive) {
      res.status(403).json({ 
        success: false, 
        message: 'Your account has been suspended. Please contact support.' 
      });
      return;
    }

    // 5. Grant access and attach user details to the request object
    req.user = await loadAccount(currentUser);
    next();

  } catch (error) {
    // A database or server failure says nothing about the session, so the client must not log out.
    console.error('[Auth Middleware] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not check your session. Please try again.'
    });
    return;
  }
};

export const requireRole = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized access.' });
      return;
    }

    const hasRole = roles.some((role) => req.user!.roles.includes(role));
    
    if (!hasRole) {
      res.status(403).json({ success: false, message: 'Forbidden. You do not have the required permissions.' });
      return;
    }

    next();
  };
};