import { Router } from 'express';
import { getRoleApplications, processRoleApplication, getUsers, deleteReview, deleteComplaint, processWithdrawalRequest, verifyDocument, getVerificationDocuments, getDashboardOverview, getBuyers, getFarmers, getDeliveryPartners, mergeUsers, blockBuyer, sendBulkNotification, getNotificationHistory, searchUsers, getComplaints, getComplaintStats, processComplaint } from '../controller/admin.controller';
import { getTransactionsOverview, getOnlinePayments, getCashCollections, getSettlements, verifyCashDeposit } from '../controller/transaction.controller';
import { getAdminCatalog, createCatalogItem, updateCatalogItem, deleteCatalogItem } from '../controller/admin.catalog.controller';
import { protect, requireRole } from '../middleware/auth.middleware';
import { upload } from '../config/multer';
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
router.get('/farmers', getFarmers);
router.get('/delivery', getDeliveryPartners);
router.post('/buyers/merge', mergeUsers);
router.patch('/buyers/:id/block', blockBuyer);
router.delete('/reviews/:id', deleteReview);
router.delete('/complaints/:id', deleteComplaint);
router.post('/withdrawals/:id/process', processWithdrawalRequest);
router.get('/documents', getVerificationDocuments);
router.post('/documents/verify', verifyDocument);
router.post('/notifications/send', sendBulkNotification);
router.get('/notifications/history', getNotificationHistory);
router.get('/users/search', searchUsers);

// Complaints Management
router.get('/complaints', getComplaints);
router.get('/complaints/stats', getComplaintStats);
router.patch('/complaints/:id/process', processComplaint);

// Transactions Management
router.get('/transactions/overview', getTransactionsOverview);
router.get('/transactions/online', getOnlinePayments);
router.get('/transactions/cash', getCashCollections);
router.get('/transactions/settlements', getSettlements);
router.post('/transactions/cash/:id/verify', verifyCashDeposit);

// Crop Catalog Management
router.get('/catalog', getAdminCatalog);
router.post('/catalog', upload.single('imageTemplate'), createCatalogItem);
router.patch('/catalog/:id', upload.single('imageTemplate'), updateCatalogItem);
router.delete('/catalog/:id', deleteCatalogItem);

export default router;
