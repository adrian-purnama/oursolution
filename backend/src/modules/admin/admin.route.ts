import { Router } from "express";
import { requireAdmin } from "../../middleware/requireAdmin";
import { requireUser } from "../../middleware/requireUser";
import { uploadSingleImage } from "../../middleware/uploadImage";
import { DeploymentController } from "../deployment/deployment.controller";
import { DokployController } from "../dokploy/dokploy.controller";
import { ProductController } from "../product/product.controller";
import { PurchaseController } from "../purchase/purchase.controller";
import { UserProductController } from "../userProduct/userProduct.controller";
import { AdminController } from "./admin.controller";

const router = Router();
const adminController = new AdminController();
const productController = new ProductController();
const dokployController = new DokployController();
const deploymentController = new DeploymentController("admin");
const userProductController = new UserProductController();
const purchaseController = new PurchaseController();

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

router.get("/products", productController.list);
router.post("/products", productController.create);
router.post("/products/deployment/check", productController.checkDeployment);
router.get("/products/:id", productController.get);
router.patch("/products/:id", productController.update);
router.post(
  "/products/:id/image",
  uploadSingleImage("file"),
  productController.updateImage,
);
router.delete("/products/:id", productController.remove);
router.post("/products/:id/restore", productController.restore);
router.delete("/products/:id/permanent", productController.removePermanently);

router.get("/dokploy/projects", dokployController.listProjects);

router.get("/users/:id/plan", userProductController.getPlan);
router.post("/users/:id/plan/override", userProductController.overrideNow);
router.post("/users/:id/plan/schedule", userProductController.scheduleNext);
router.post(
  "/users/:id/plan/products/:productId/end",
  userProductController.endNow,
);
router.delete(
  "/users/:id/plan/periods/:periodId",
  userProductController.deletePeriod,
);

router.get("/deployments", deploymentController.listAll);
router.get("/users/:id/deployments", deploymentController.list);
router.get("/users/:id/deployments/:productId", deploymentController.get);
router.put(
  "/users/:id/deployments/:productId/values",
  deploymentController.updateValues,
);
router.post(
  "/users/:id/deployments/:productId/actions",
  deploymentController.start,
);

router.get("/users/:id/purchases", purchaseController.list);
router.post("/users/:id/purchases", purchaseController.grant);
router.delete("/users/:id/purchases/:purchaseId", purchaseController.revoke);

export default router;
