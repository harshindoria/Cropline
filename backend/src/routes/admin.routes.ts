import { Router } from 'express';
import { getRoleApplications, processRoleApplication, getUsers, deleteReview, deleteComplaint, processWithdrawalRequest } from '../controller/admin.controller';
import { protect, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Only ADMIN can access these routes
router.use(protect);
router.use(requireRole(Role.ADMIN));

router.get('/applications', getRoleApplications);
router.patch('/applications/:id', processRoleApplication);
router.get('/users', getUsers);
router.delete('/reviews/:id', deleteReview);
router.delete('/complaints/:id', deleteComplaint);
router.post('/withdrawals/:id/process', processWithdrawalRequest);

export default router;
