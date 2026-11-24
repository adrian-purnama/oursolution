import type { Request, Response } from "express";
import type {
  AdminDeploymentRowOutDto,
  DeploymentBulkOutDto,
  DeploymentOutDto,
  DeploymentSyncOutDto,
} from "../../dto/deployment.dto";
import {
  parseDeploymentActionInDto,
  parseDeploymentBulkInDto,
  parseUpdateDeploymentOverridesInDto,
  parseUpdateDeploymentValuesInDto,
} from "../../validation/deployment";
import { parseParam, parseRouteId } from "../../validation/parseParam";
import { deploymentService, type DeploymentView } from "./deployment.service";
import { fail, ok } from "../../utils/respond";

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
      return ok<AdminDeploymentRowOutDto[]>(res, "Deployments retrieved", data);
    } catch (error) {
      return fail(res, error, "Failed to load deployments");
    }
  };

  /** Admin: bring every deployment in step with Dokploy and Cloudflare. */
  syncAll = async (_req: Request, res: Response) => {
    try {
      const data = await deploymentService.syncAll();
      return ok<DeploymentSyncOutDto>(res, "Deployments synced", data);
    } catch (error) {
      return fail(res, error, "Failed to sync deployments");
    }
  };

  /** Admin: turn on, turn off or erase many deployments at once. */
  bulk = async (req: Request, res: Response) => {
    try {
      const input = parseDeploymentBulkInDto(req.body);
      const data = await deploymentService.bulk(input, req.user!.id);
      return ok<DeploymentBulkOutDto>(res, "Bulk action done", data);
    } catch (error) {
      return fail(res, error, "Failed to run the bulk action");
    }
  };

  list = async (req: Request, res: Response) => {
    try {
      const data = await deploymentService.list(
        target(req, this.view),
        this.view,
      );
      return ok<DeploymentOutDto[]>(res, "Deployments retrieved", data);
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
      return ok<DeploymentOutDto>(res, "Deployment retrieved", data);
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
      return ok<DeploymentOutDto>(res, "Settings saved", data);
    } catch (error) {
      return fail(res, error, "Failed to save the settings");
    }
  };

  /** Admin: replace the deployment's overrides of the product. */
  updateOverrides = async (req: Request, res: Response) => {
    try {
      const input = parseUpdateDeploymentOverridesInDto(req.body);
      const data = await deploymentService.updateOverrides(
        target(req, this.view),
        productIdOf(req),
        input,
        req.user!.id,
      );
      return ok<DeploymentOutDto>(res, "Overrides saved", data);
    } catch (error) {
      return fail(res, error, "Failed to save the overrides");
    }
  };

  runCommand = async (req: Request, res: Response) => {
    try {
      const commandId = parseParam(req.params.commandId, {
        label: "command id",
      });
      const data = await deploymentService.startCommand(
        target(req, this.view),
        productIdOf(req),
        commandId,
        req.user!.id,
        this.view,
      );
      return ok<DeploymentOutDto>(res, "Started", data, 202);
    } catch (error) {
      return fail(res, error, "Failed to run the command");
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
      return ok<DeploymentOutDto>(res, "Started", data, 202);
    } catch (error) {
      return fail(res, error, "Failed to start");
    }
  };
}
