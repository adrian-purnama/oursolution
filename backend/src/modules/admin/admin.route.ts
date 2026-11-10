import { Router } from "express";
import { requireAdmin } from "../../middleware/requireAdmin";
import { requireUser } from "../../middleware/requireUser";
import { uploadSingleImage } from "../../middleware/uploadImage";
import { PlanController } from "../plan/plan.controller";
import { UserPlanController } from "../userPlan/userPlan.controller";
import { AdminController } from "./admin.controller";

const router = Router();
const adminController = new AdminController();
const planController = new PlanController();
const userPlanController = new UserPlanController();

// Everything under /admin is admin-only.
router.use(requireUser, requireAdmin);

router.get("/app-config", adminController.getAppConfig);
router.patch("/app-config", adminController.updateAppConfig);
router.post(
  "/app-logo",
  uploadSingleImage("file"),
  adminController.updateAppLogo,
);

router.get("/users", adminController.searchUsers);
router.get("/users/:id", adminController.getUser);
router.patch("/users/:id", adminController.updateUser);

router.get("/plans", planController.list);
router.post("/plans", planController.create);
router.patch("/plans/:id", planController.update);
router.delete("/plans/:id", planController.remove);

router.get("/users/:id/plan", userPlanController.getOverview);
router.post("/users/:id/plan/override", userPlanController.overrideNow);
router.post("/users/:id/plan/schedule", userPlanController.scheduleNext);
router.delete(
  "/users/:id/plan/periods/:periodId",
  userPlanController.deleteScheduled,
);

export default router;
