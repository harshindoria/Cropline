import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwtUtils';
import prisma from '../config/db';
import { User, Role } from '@prisma/client';

// Extending Express Request to attach the authenticated user object
declare global {
  namespace Express {
    interface Request {
      user?: User; 
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

    // 2. Verify the token cryptographically
    const decoded = verifyToken(token);

    // 3. Verify if the user still exists in the database
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!currentUser) {
      res.status(401).json({ 
        success: false, 
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
    req.user = currentUser;
    next();

  } catch (error) {
    console.error('[Auth Middleware] Error:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token. Please log in again.' 
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