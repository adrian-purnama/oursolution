import { Router } from "express";
import { requireUser } from "../../middleware/requireUser";
import { UserPlanController } from "./userPlan.controller";

const router = Router();
const userPlanController = new UserPlanController();

// The signed-in user's own plan timeline. Admin edits live under /admin.
router.get("/plan", requireUser, userPlanController.getOwnOverview);

export default router;
