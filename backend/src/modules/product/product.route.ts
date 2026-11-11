import { Router } from "express";
import { ProductController } from "./product.controller";

const router = Router();
const productController = new ProductController();

// Public. Product management lives under /admin.
router.get("/pricing", productController.listPricing);
router.get("/pricing/:id", productController.getPricing);

export default router;
