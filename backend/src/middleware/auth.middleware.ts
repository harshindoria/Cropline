import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwtUtils';
import prisma from '../config/db';

// Express ki Request type ko extend kar rahe hain taaki req.user mein data daal sakein
declare global {
  namespace Express {
    interface Request {
      user?: any; // Aage chalkar jab types define karenge toh ise proper User type denge
    }
  }
}

export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // 1. Check karna ki header mein token aaya hai ya nahi
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1]; // "Bearer <token>" se sirf token nikalna
    }

    if (!token) {
      res.status(401).json({ success: false, message: 'Aap logged in nahi hain. Kripya login karein.' });
      return;
    }

    // 2. Token ko verify karna (Jo function humne jwtUtils mein banaya tha)
    const decoded = verifyToken(token);

    // 3. Check karna ki kya yeh user sach mein database mein exist karta hai
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!currentUser) {
      res.status(401).json({ success: false, message: 'Yeh user ab exist nahi karta.' });
      return;
    }

    if (!currentUser.isActive) {
      res.status(403).json({ success: false, message: 'Aapka account suspend kar diya gaya hai.' });
      return;
    }

    // 4. Sab sahi hai! User ko aage jane do aur uski details request mein save kar do
    req.user = currentUser;
    next(); // Guard ne gate khol diya (Agla controller run hoga)

  } catch (error) {
    res.status(401).json({ success: false, message: 'Token invalid ya expire ho gaya hai.' });
    return;
  }
};