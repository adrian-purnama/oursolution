import { Router } from "express";
import { credentialRateLimit, otpRateLimit } from "../../middleware/rateLimit";
import { requireUser } from "../../middleware/requireUser";
import { AuthController } from "./auth.controller";

const router = Router();
const authController = new AuthController();

router.post("/otp", otpRateLimit, authController.sendOtp);
router.post("/register", credentialRateLimit, authController.register);
router.post("/login", credentialRateLimit, authController.login);
router.post(
  "/reset-password",
  credentialRateLimit,
  authController.resetPassword,
);
router.get("/validate", requireUser, authController.validateUser);

export default router;
