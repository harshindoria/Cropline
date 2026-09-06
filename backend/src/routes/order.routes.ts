import { Router } from 'express';
import {
  createOrder,
  getOrders,
  getOrderById,
  confirmOrder,
  rejectOrder,
  markReady,
  cancelOrder,
} from '../controller/order.controller';
import { protect } from '../middleware/auth.middleware';
import { restrictTo, requireRoleOperational } from '../middleware/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

// ── GLOBAL SECURITY ──────────────────────────────────────────────────────────
router.use(protect);

// ── BUYER ROUTES ─────────────────────────────────────────────────────────────
router.post('/', restrictTo(Role.BUYER), requireRoleOperational(Role.BUYER), createOrder);
router.patch('/:id/cancel', restrictTo(Role.BUYER), cancelOrder);

// Buyer fetches their QR code to show to the driver at doorstep

// ── DRIVER ROUTES ─────────────────────────────────────────────────────────────
// Driver scans the Buyer's QR code to complete delivery

// ── FARMER ROUTES ─────────────────────────────────────────────────────────────
router.patch('/:id/confirm', restrictTo(Role.FARMER), confirmOrder);
router.patch('/:id/reject', restrictTo(Role.FARMER), rejectOrder);
router.patch('/:id/ready', restrictTo(Role.FARMER), markReady);

// ── SHARED ROUTES ─────────────────────────────────────────────────────────────
router.get('/', getOrders);
router.get('/:id', getOrderById);

export default router;
