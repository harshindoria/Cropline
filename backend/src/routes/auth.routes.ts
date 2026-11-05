import { Router } from 'express';
import { changePhone, loginWithPhone } from '../controller/auth.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// 1. Phone OTP se login karne ka route
// Endpoint: POST /api/v1/auth/login/phone
router.post('/login/phone', loginWithPhone);

// 2. Verified phone number change
// Endpoint: POST /api/v1/auth/change-phone
router.post('/change-phone', protect, changePhone);

export default router;
