import http from "http";
import cors from "cors";
import helmet from "helmet";
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { ApiResponseDto } from "./dto/apiResponse.dto";
import { connectDatabase } from "./database/database";
import { env } from "./environment/env";
import { appConfigService } from "./modules/appConfig/appConfig.service";
import { logger } from "./logger/logger";
import adminRoutes from "./modules/admin/admin.route";
import appConfigRoutes from "./modules/appConfig/appConfig.route";
import authRoutes from "./modules/auth/auth.route";
import deploymentRoutes from "./modules/deployment/deployment.route";
import { startLapsedSubscriptionSweep } from "./modules/deployment/deployment.scheduler";
import { deploymentService } from "./modules/deployment/deployment.service";
import mediaRoutes from "./modules/media/media.route";
import productRoutes from "./modules/product/product.route";
import { productService } from "./modules/product/product.service";
import userProductRoutes from "./modules/userProduct/userProduct.route";

function createApp(): Express {
  const app = express();
  app.set("trust proxy", 1);

  app.disable("x-powered-by");
  app.use(
    helmet({
      // The frontend lives on another origin and loads /media images from here.
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(
    cors({
      origin: env.frontendUrl,
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({
      success: true,
      message: "Server is healthy",
      data: { build: env.build },
    } satisfies ApiResponseDto<{ build: string }>);
  });

  app.use("/auth", authRoutes);
  app.use("/admin", adminRoutes);
  app.use("/app-config", appConfigRoutes);
  app.use("/media", mediaRoutes);
  app.use("/products", productRoutes);
  app.use("/me/deployments", deploymentRoutes);
  app.use("/me", userProductRoutes);

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      message: "Route not found",
      data: null,
    } satisfies ApiResponseDto);
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    logger.error(
      err instanceof Error ? err.message : "Unhandled server error",
      "index",
      "createApp",
    );

    res.status(500).json({
      success: false,
      message: "Internal server error",
      data: null,
    } satisfies ApiResponseDto);
  });

  return app;
}

async function bootstrap() {
  await connectDatabase(env.mongodbUrl, env.build);

  const app = createApp();
  await appConfigService.init();
  // Runs cut short by a restart cannot resume; mark them failed.
  await productService.migrateLegacyDomains();
  await deploymentService.recoverInterruptedRuns();
  // Services whose subscription ended are turned off by themselves.
  startLapsedSubscriptionSweep();

  const httpServer = http.createServer(app);

  httpServer.listen(env.port, () => {
    logger.info(
      `Server running at http://localhost:${env.port} (${env.build})`,
      "index",
      "bootstrap",
    );
  });
}

bootstrap().catch((err) => {
  logger.error(
    err instanceof Error ? err.message : String(err),
    "index",
    "bootstrap",
  );
  process.exit(1);
});
