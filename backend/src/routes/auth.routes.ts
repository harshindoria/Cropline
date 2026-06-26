import { Router } from 'express';
import { loginWithPhone, loginWithEmail } from '../controller/auth.controller';

const router = Router();

// 1. Phone OTP se login karne ka route
// Endpoint: POST /api/v1/auth/login/phone
router.post('/login/phone', loginWithPhone);

// 2. Google (Email) se login karne ka route
// Endpoint: POST /api/v1/auth/login/email
router.post('/login/email', loginWithEmail);

export default router;