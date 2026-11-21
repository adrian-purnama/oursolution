import { Router } from "express";
import { requireAdmin } from "../../middleware/requireAdmin";
import { requireUser } from "../../middleware/requireUser";
import { uploadSingleImage } from "../../middleware/uploadImage";
import { BroadcastController } from "../broadcast/broadcast.controller";
import { DeploymentController } from "../deployment/deployment.controller";
import { DokployController } from "../dokploy/dokploy.controller";
import { PaymentController } from "../payment/payment.controller";
import { ProductController } from "../product/product.controller";
import { PurchaseController } from "../purchase/purchase.controller";
import { RedeemCodeController } from "../redeemCode/redeemCode.controller";
import { TicketController } from "../ticket/ticket.controller";
import { UserProductController } from "../userProduct/userProduct.controller";
import { MAX_TICKET_IMAGE_BYTES } from "../../utils/ticketImage";
import { AdminController } from "./admin.controller";

const router = Router();
const adminController = new AdminController();
const productController = new ProductController();
const dokployController = new DokployController();
const deploymentController = new DeploymentController("admin");
const userProductController = new UserProductController();
const purchaseController = new PurchaseController();
const paymentController = new PaymentController();
const ticketController = new TicketController();
const redeemCodeController = new RedeemCodeController();
const broadcastController = new BroadcastController();

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
router.post("/users", adminController.createUser);
router.get("/users/:id", adminController.getUser);
router.patch("/users/:id", adminController.updateUser);

router.get("/products", productController.list);
router.post("/products", productController.create);
router.post("/products/deployment/check", productController.checkDeployment);
router.get("/products/:id", productController.get);
router.patch("/products/:id", productController.update);
router.post(
  "/products/:id/images",
  uploadSingleImage("file"),
  productController.addImage,
);
router.put("/products/:id/images/order", productController.reorderImages);
router.delete("/products/:id/images/:imageId", productController.removeImage);
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
router.post("/deployments/sync", deploymentController.syncAll);
router.post("/deployments/bulk", deploymentController.bulk);
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
router.post(
  "/users/:id/deployments/:productId/commands/:commandId",
  deploymentController.runCommand,
);

router.get("/tickets", ticketController.listAll);
router.get("/tickets/:id", ticketController.getAny);
router.post(
  "/tickets/:id/messages",
  uploadSingleImage("image", MAX_TICKET_IMAGE_BYTES),
  ticketController.addAdminMessage,
);
router.patch("/tickets/:id/status", ticketController.setStatus);
router.post("/tickets/:id/close", ticketController.close);

router.get("/users/:id/purchases", purchaseController.list);
router.post("/users/:id/purchases", purchaseController.grant);
router.delete("/users/:id/purchases/:purchaseId", purchaseController.revoke);

router.get("/users/:id/payments", paymentController.listForUser);
router.post("/users/:id/payments", paymentController.createForUser);
router.get("/payments", paymentController.listAll);
router.get("/payments/:paymentId", paymentController.getAny);
router.get("/payments/:paymentId/invoice.pdf", paymentController.invoiceAny);

router.get("/redeem-codes", redeemCodeController.list);
router.post("/redeem-codes", redeemCodeController.create);
router.delete("/redeem-codes/:id", redeemCodeController.remove);

router.get("/broadcasts", broadcastController.list);
router.post("/broadcasts", broadcastController.send);
router.post("/broadcasts/audience", broadcastController.preview);

export default router;
