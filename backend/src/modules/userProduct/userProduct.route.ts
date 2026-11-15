import { Router } from "express";
import { requireUser } from "../../middleware/requireUser";
import { PaymentController } from "../payment/payment.controller";
import { PurchaseController } from "../purchase/purchase.controller";
import { UserProductController } from "./userProduct.controller";

const router = Router();
const userProductController = new UserProductController();
const paymentController = new PaymentController();
const purchaseController = new PurchaseController();

// The signed-in user's own plan. Admin edits live under /admin.
router.use(requireUser);

router.get("/plan", userProductController.getOwnPlan);
router.get("/purchases", purchaseController.listOwn);
router.post("/checkout", paymentController.checkout);
router.post("/checkout/quote", paymentController.quote);
router.get("/payments", paymentController.listOwn);
router.get("/payments/:id", paymentController.getOwn);
router.post("/payments/:id/cancel", paymentController.cancelOwn);
router.get("/payments/:id/invoice.pdf", paymentController.invoiceOwn);

export default router;
