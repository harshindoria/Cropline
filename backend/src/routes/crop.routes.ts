import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import { restrictTo, requireRoleOperational } from "../middleware/role.middleware";
import { upload } from "../config/multer";
import { 
  createCrop, 
  getCrops, 
  getCropById, 
  getMyCrops,
  updateCrop,
  pauseCrop,
  resumeCrop,
  deleteCrop,
  getCatalog,
  getFarmerStats
} from "../controller/crop.controller";
import { Role } from "@prisma/client";

const router = Router();

// ── 1. PUBLIC ROUTES ──────────────────────────────────────────────────────────
router.get('/', getCrops); 
router.get('/catalog', getCatalog);

// ── 2. SPECIFIC PROTECTED ROUTES (Hamesha /:id ke upar aayenge) ───────────────
router.get('/farmer/mine', protect, restrictTo(Role.FARMER), getMyCrops);
router.get('/farmer/stats', protect, restrictTo(Role.FARMER), getFarmerStats);

// ── 3. DYNAMIC PARAM ROUTES (Hamesha static routes ke neeche aayenge) ─────────
router.get('/:id', getCropById);

// ── 4. PROTECTED ACTION ROUTES ────────────────────────────────────────────────
router.post('/', protect, restrictTo(Role.FARMER), requireRoleOperational(Role.FARMER), upload.array('photos', 5), createCrop);
router.put('/:id', protect, restrictTo(Role.FARMER), updateCrop);
router.patch('/:id/pause', protect, restrictTo(Role.FARMER), pauseCrop);
router.patch('/:id/resume', protect, restrictTo(Role.FARMER), requireRoleOperational(Role.FARMER), resumeCrop);
router.delete('/:id', protect, restrictTo(Role.FARMER), deleteCrop);

export default router;
