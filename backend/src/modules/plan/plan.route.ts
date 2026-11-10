import { Router } from "express";
import { PlanController } from "./plan.controller";

const router = Router();
const planController = new PlanController();

// Public. Plan management lives under /admin.
router.get("/pricing", planController.listPricing);

export default router;
