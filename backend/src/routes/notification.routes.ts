import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { getMyNotifications } from '../controller/notification.controller';

const router = Router();

router.use(protect);

router.get('/', getMyNotifications);

export default router;
