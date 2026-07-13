import { Router } from 'express';
import { getRoleApplications, processRoleApplication, getUsers, deleteReview, deleteComplaint, processWithdrawalRequest, verifyDocument, getDashboardOverview, getBuyers, mergeUsers, blockBuyer } from '../controller/admin.controller';
import { protect, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Only ADMIN can access these routes
router.use(protect);
router.use(requireRole(Role.ADMIN));

router.get('/overview', getDashboardOverview);
router.get('/applications', getRoleApplications);
router.patch('/applications/:id', processRoleApplication);
router.get('/users', getUsers);
router.get('/buyers', getBuyers);
router.post('/buyers/merge', mergeUsers);
router.patch('/buyers/:id/block', blockBuyer);
router.delete('/reviews/:id', deleteReview);
router.delete('/complaints/:id', deleteComplaint);
router.post('/withdrawals/:id/process', processWithdrawalRequest);
router.post('/documents/verify', verifyDocument);

export default router;
