import express from 'express';
import { getMyReviews, submitReview } from '../controller/review.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

router.get('/me', protect, getMyReviews);
router.post('/', protect, submitReview);

export default router;
