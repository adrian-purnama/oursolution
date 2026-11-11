import type { Request, Response } from "express";
import { ApiResponseDto } from "../../dto/apiResponse.dto";
import type {
  AdminDeploymentRowOutDto,
  DeploymentOutDto,
} from "../../dto/deployment.dto";
import {
  parseDeploymentActionInDto,
  parseUpdateDeploymentValuesInDto,
} from "../../validation/deployment";
import { parseParam, parseRouteId } from "../../validation/parseParam";
import {
  DeploymentBusyError,
  DeploymentLimitError,
  deploymentService,
  type DeploymentView,
} from "./deployment.service";

function ok<T>(res: Response, status: number, message: string, data: T) {
  return res.status(status).json({
    success: true,
    message,
    data,
  } satisfies ApiResponseDto<T>);
}

function fail(res: Response, error: unknown, fallback: string) {
  const status =
    error instanceof DeploymentBusyError
      ? 409
      : error instanceof DeploymentLimitError
        ? 429
        : 400;
  return res.status(status).json({
    success: false,
    message: error instanceof Error ? error.message : fallback,
    data: null,
  } satisfies ApiResponseDto);
}

/** Whose deployments: the signed-in user's, or (admin) the route's user. */
function target(req: Request, view: DeploymentView): string {
  return view === "customer" ? req.user!.id : parseRouteId(req.params.id);
}

function productIdOf(req: Request): string {
  return parseParam(req.params.productId, {
    label: "product id",
    objectId: true,
  });
}

/**
 * Deployments of a user's subscriptions. The same handlers serve customers
 * (their own, vague step names) and admins (anyone's, with errors).
 */
export class DeploymentController {
  constructor(private readonly view: DeploymentView) {}

  /** Admin: every user's deployments at once. */
  listAll = async (_req: Request, res: Response) => {
    try {
      const data = await deploymentService.listAll();
      return ok<AdminDeploymentRowOutDto[]>(
        res,
        200,
        "Deployments retrieved",
        data,
      );
    } catch (error) {
      return fail(res, error, "Failed to load deployments");
    }
  };

  list = async (req: Request, res: Response) => {
    try {
      const data = await deploymentService.list(
        target(req, this.view),
        this.view,
      );
      return ok<DeploymentOutDto[]>(res, 200, "Deployments retrieved", data);
    } catch (error) {
      return fail(res, error, "Failed to load deployments");
    }
  };

  get = async (req: Request, res: Response) => {
    try {
      const data = await deploymentService.get(
        target(req, this.view),
        productIdOf(req),
        this.view,
      );
      return ok<DeploymentOutDto>(res, 200, "Deployment retrieved", data);
    } catch (error) {
      return fail(res, error, "Failed to load the deployment");
    }
  };

  updateValues = async (req: Request, res: Response) => {
    try {
      const { values } = parseUpdateDeploymentValuesInDto(req.body);
      const data = await deploymentService.updateValues(
        target(req, this.view),
        productIdOf(req),
        values,
        this.view,
      );
      return ok<DeploymentOutDto>(res, 200, "Settings saved", data);
    } catch (error) {
      return fail(res, error, "Failed to save the settings");
    }
  };

  start = async (req: Request, res: Response) => {
    try {
      const { action } = parseDeploymentActionInDto(req.body);
      const data = await deploymentService.start(
        target(req, this.view),
        productIdOf(req),
        action,
        req.user!.id,
        this.view,
      );
      return ok<DeploymentOutDto>(res, 202, "Started", data);
    } catch (error) {
      return fail(res, error, "Failed to start");
    }
  };
}
