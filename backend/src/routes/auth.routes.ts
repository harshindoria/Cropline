import { Router } from "express";
import { loginWithPhone } from "../controller/auth.controller";

const router = Router();

router.post('/login-phone',loginWithPhone);

export default router;