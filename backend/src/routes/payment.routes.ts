import { Router } from 'express';
import {
  initiateOrderPayment,
  razorpayWebhook,
  getDriverOutstandingSummary,
  createDriverSettlementLink
} from '../controller/payment.controller';
import { protect } from '../middleware/auth.middleware';
import { restrictTo, requireRoleOperational } from '../middleware/role.middleware';
import { Role } from '@prisma/client';
import express from 'express';

const router = Router();

// ── RAZORPAY WEBHOOK (No auth — Razorpay calls this) ──────────────────────
// Raw body needed for signature verification
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  razorpayWebhook
);

// ── PROTECTED ROUTES ───────────────────────────────────────────────────────
router.use(protect);

// ── BUYER ROUTES ───────────────────────────────────────────────────────────
// Initiate Razorpay payment for an order
router.post(
  '/order/:orderId/initiate',
  restrictTo(Role.BUYER),
  requireRoleOperational(Role.BUYER),
  initiateOrderPayment
);

// ── DELIVERY PARTNER ROUTES ────────────────────────────────────────────────
// View outstanding cash liability summary
router.get(
  '/delivery/summary',
  restrictTo(Role.DELIVERY),
  getDriverOutstandingSummary
);

// Generate settlement payment link
router.post(
  '/delivery/settle',
  restrictTo(Role.DELIVERY),
  requireRoleOperational(Role.DELIVERY),
  createDriverSettlementLink
);

export default router;
