import { Router } from "express";
import { redeemRateLimit } from "../../middleware/rateLimit";
import { requireUser } from "../../middleware/requireUser";
import { RedeemCodeController } from "./redeemCode.controller";

const router = Router();
const controller = new RedeemCodeController();

// The admin routes for codes are in admin.route.ts.
router.post("/", redeemRateLimit, requireUser, controller.redeem);

export default router;
