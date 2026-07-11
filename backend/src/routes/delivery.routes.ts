import { Router } from 'express';
// Assuming aapke auth middlewares hain
import { protect} from '../middleware/auth.middleware'; 
import { restrictTo, requireRoleOperational, checkDeliveryLiabilityLimit } from '../middleware/role.middleware';
// Assuming aapka multer setup hai
import { upload } from '../config/multer'; 
import { Role } from '@prisma/client';

import { 
  getNearbyJobs,
  getActiveJobs, 
  acceptJob, 
  updateLocation, 
  markPickedUp, 
  markDelivered 
} from '../controller/delivery.controller';
import { getMonthlyEarnings, getTodaySummary, updateDailyGoal } from '../controller/delivery-stats.controller';

const router = Router();

// ── GLOBAL BOUNCER ──
// Is file ke saare routes par jane se pehle user ka login hona zaroori hai
router.use(protect); 

// ── STATS ROUTES ──
router.get('/stats/monthly', restrictTo(Role.DELIVERY), getMonthlyEarnings);
router.get('/stats/summary', restrictTo(Role.DELIVERY), getTodaySummary);
router.patch('/stats/goal', restrictTo(Role.DELIVERY), updateDailyGoal);

// ── THE ROUTES ──
router.get('/nearby', restrictTo(Role.DELIVERY), requireRoleOperational(Role.DELIVERY),checkDeliveryLiabilityLimit, getNearbyJobs);
router.get('/jobs/active', restrictTo(Role.DELIVERY), requireRoleOperational(Role.DELIVERY), getActiveJobs);
router.post('/jobs/:orderId/accept', restrictTo(Role.DELIVERY), requireRoleOperational(Role.DELIVERY),checkDeliveryLiabilityLimit, acceptJob);
router.patch('/location', restrictTo(Role.DELIVERY), updateLocation);

// (Aapka naya QR wala pickup logic)
router.patch('/jobs/pickup', restrictTo(Role.DELIVERY), markPickedUp);

// (Hamara The Assembly Line Route)
router.patch(
  '/jobs/:jobId/deliver', 
  restrictTo(Role.DELIVERY), 
  upload.single('photo'), // Frontend se form data field ka naam 'photo' hona chahiye
  markDelivered
);

export default router;
