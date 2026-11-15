import { Router } from "express";
import { PaymentController } from "./payment.controller";

const router = Router();
const paymentController = new PaymentController();

// Public, mounted at /payments.
// What the browser needs to show the payment form (public keys only).
router.get("/config", paymentController.config);
// Called by Midtrans, which proves itself with a signature, not a user token.
router.post("/midtrans/notification", paymentController.midtransNotification);

export default router;
