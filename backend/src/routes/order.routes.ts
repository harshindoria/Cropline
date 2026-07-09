import { Router } from 'express';
import {
  createOrder,
  getOrders,
  getOrderById,
  confirmOrder,
  rejectOrder,
  markReady,
  scanQR,
  getPickupToken,
  sendPickupOtp,
  verifyPickupOtp,
  getHandoverToken,
  cancelOrder
} from '../controller/order.controller';
import { protect } from '../middleware/auth.middleware';
import { restrictTo, requireRoleOperational } from '../middleware/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

// ── GLOBAL SECURITY ─────────────────────────────────────────────────────────
// Is router ki sabhi APIs ke liye user ka logged-in hona zaroori hai
router.use(protect);

// ── BUYER ROUTES (Sirf Grahak ke liye) ──────────────────────────────────────
// Order create karne ka haq sirf Buyer ko hai
router.post('/', restrictTo(Role.BUYER), requireRoleOperational(Role.BUYER), createOrder);

// Digital Ticket (QR Token) dekhne ka haq sirf Buyer ko hai
router.get('/:id/pickup-token', restrictTo(Role.BUYER), getPickupToken);

// Buyer can cancel a pending order
router.patch('/:id/cancel', restrictTo(Role.BUYER), cancelOrder);


// ── FARMER ROUTES (Sirf Kisaan ke liye) ─────────────────────────────────────
// Order lifecycle control karne ka haq sirf Farmer ko hai
router.patch('/:id/confirm', restrictTo(Role.FARMER), confirmOrder);
router.patch('/:id/reject', restrictTo(Role.FARMER), rejectOrder);
router.patch('/:id/ready', restrictTo(Role.FARMER), markReady);

// Fasal handover aur payment receive karne ka haq sirf Farmer ko hai
router.post('/scan-qr', restrictTo(Role.FARMER), scanQR);

// (Optional) OTP Flow ke routes
//router.post('/:id/pickup-otp/send', restrictTo(Role.FARMER), sendPickupOtp);
//router.post('/:id/pickup-otp/verify', restrictTo(Role.FARMER), verifyPickupOtp);


// ── SHARED ROUTES (Smart APIs) ──────────────────────────────────────────────
// In APIs mein internal gatekeepers hain jo Role ke hisaab se data filter karte hain.
// Isliye yahan humne alag se restrictTo() nahi lagaya hai, koi bhi logged-in user inhe call kar sakta hai.
router.get('/', getOrders);
router.get('/:id', getOrderById);
router.get('/:id/handover-token',restrictTo(Role.FARMER),getHandoverToken);

export default router;
