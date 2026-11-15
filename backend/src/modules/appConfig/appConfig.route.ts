import { Router } from "express";
import { AppConfigController } from "./appConfig.controller";

const router = Router();
const appConfigController = new AppConfigController();

router.get("/branding", appConfigController.getBranding);
router.get("/contact", appConfigController.getContact);

export default router;
