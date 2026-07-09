import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { getBuyerAnalytics, getCropTrends } from '../controller/analytics.controller';

const router = Router();

router.get('/buyer', protect, getBuyerAnalytics);
router.get('/crop-trends', protect, getCropTrends);

export default router;
