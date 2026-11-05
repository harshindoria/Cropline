import { Router } from 'express';
import { Role } from '@prisma/client';
import { createWithdrawal, getMyWithdrawals } from '../controller/wallet.controller';
import { protect } from '../middleware/auth.middleware';
import { restrictTo } from '../middleware/role.middleware';

const router = Router();

router.use(protect);
router.use(restrictTo(Role.FARMER, Role.DELIVERY));

router.post('/withdrawals', createWithdrawal);
router.get('/withdrawals', getMyWithdrawals);

export default router;
