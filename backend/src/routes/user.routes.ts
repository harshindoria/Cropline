import { Router } from 'express';

import { protect } from '../middleware/auth.middleware';
import { buyerProfile, deliveryProfile, farmerProfile, getProfile, updateProfile, switchRole, onboardRole, setRoleBlock, getFarmerPublicProfile, toggleOnlineStatus } from '../controller/user.controller';
import { restrictTo } from '../middleware/role.middleware';
import { Role } from '@prisma/client';
const router = Router();

router.get('/profile', protect, getProfile);
router.get('/profile/buyer', protect, buyerProfile);
router.get('/profile/delivery', protect, deliveryProfile);
router.get('/profile/farmer', protect, farmerProfile);
router.patch('/profile', protect, updateProfile);
router.post('/switch-role', protect, switchRole);
router.post('/onboard-role', protect, onboardRole);
router.patch('/admin/role-access', protect, restrictTo(Role.ADMIN), setRoleBlock);
router.get('/farmer/:id/public', protect, getFarmerPublicProfile);
router.patch('/online-status', protect, toggleOnlineStatus);

export default router;
