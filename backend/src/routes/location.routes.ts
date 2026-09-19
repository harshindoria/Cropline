import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { reverseGeocodeLocation } from '../controller/location.controller';

const router = Router();

router.post('/geocode', protect, reverseGeocodeLocation);

export default router;
