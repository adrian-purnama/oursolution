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
router.get("/google", authController.googleConfig);
router.post("/google", credentialRateLimit, authController.googleSignIn);
router.post(
  "/google/link",
  credentialRateLimit,
  requireUser,
  authController.linkGoogle,
);
router.get("/validate", requireUser, authController.validateUser);

export default router;
