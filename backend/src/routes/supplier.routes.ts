import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { getSuppliers } from '../controller/supplier.controller';

const router = Router();

router.get('/', protect, getSuppliers);

export default router;
