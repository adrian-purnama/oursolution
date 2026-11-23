import { Router } from "express";
import { requireUser } from "../../middleware/requireUser";
import { rememberBillingRegion } from "../payment/billingRegion";
import { BasketController } from "./basket.controller";

const router = Router();
const basketController = new BasketController();

// Mounted at /me/basket: the signed-in user's own basket.
router.use(requireUser, rememberBillingRegion);

router.get("/", basketController.get);
router.post("/items", basketController.add);
router.patch("/items/:productId", basketController.setQuantity);
router.delete("/items/:productId", basketController.remove);
router.delete("/", basketController.clear);

export default router;
