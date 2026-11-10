import { Router } from "express";
import { AppConfigController } from "./appConfig.controller";

const router = Router();
const appConfigController = new AppConfigController();

router.get("/branding", appConfigController.getBranding);

export default router;
