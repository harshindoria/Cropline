import express from 'express';
import { createComplaint } from '../controller/complaint.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

router.post('/', protect, createComplaint);

export default router;
