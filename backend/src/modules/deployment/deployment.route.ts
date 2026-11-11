import { Router } from "express";
import { deploymentRateLimit } from "../../middleware/rateLimit";
import { requireUser } from "../../middleware/requireUser";
import { DeploymentController } from "./deployment.controller";

const router = Router();
const deploymentController = new DeploymentController("customer");

// The signed-in user's own deployments. Admin access lives under /admin.
router.use(requireUser);

router.get("/", deploymentController.list);
router.get("/:productId", deploymentController.get);
router.put(
  "/:productId/values",
  deploymentRateLimit,
  deploymentController.updateValues,
);
router.post(
  "/:productId/actions",
  deploymentRateLimit,
  deploymentController.start,
);

export default router;
