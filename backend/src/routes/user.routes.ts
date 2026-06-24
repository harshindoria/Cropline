import { Router } from 'express';

import { protect } from '../middleware/auth.middleware';
import { getProfile } from '../controller/user.controller';
import { updateProfile } from '../controller/user.controller';
const router = Router();

router.get('/profile',protect,getProfile);
router.patch('/profile',protect,updateProfile);

export default router;