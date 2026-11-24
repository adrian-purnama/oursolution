import type { Request, Response } from "express";
import type { UserPlanOutDto } from "../../dto/userProduct.dto";
import { parseParam, parseRouteId } from "../../validation/parseParam";
import { parseAssignProductDto } from "../../validation/product";
import { userProductService } from "./userProduct.service";
import { fail, ok } from "../../utils/respond";

/** A user's plan (their product periods): their own view, and admin actions on anyone's. */
export class UserProductController {
  getOwnPlan = async (req: Request, res: Response) => {
    try {
      return ok(
        res,
        "Your plan retrieved",
        await userProductService.getPlan(req.user!.id),
      );
    } catch (error) {
      return fail(res, error, "Failed to load your plan");
    }
  };

  getPlan = async (req: Request, res: Response) => {
    try {
      const userId = parseRouteId(req.params.id);
      return ok(
        res,
        "User plan retrieved",
        await userProductService.getPlan(userId),
      );
    } catch (error) {
      return fail(res, error, "Failed to load the user's plan");
    }
  };

  overrideNow = async (req: Request, res: Response) => {
    try {
      const userId = parseRouteId(req.params.id);
      const data = await userProductService.overrideNow(
        userId,
        parseAssignProductDto(req.body),
        req.user!.id,
      );
      return ok<UserPlanOutDto>(res, "Product started", data);
    } catch (error) {
      return fail(res, error, "Failed to start the product");
    }
  };

  scheduleNext = async (req: Request, res: Response) => {
    try {
      const userId = parseRouteId(req.params.id);
      const data = await userProductService.scheduleNext(
        userId,
        parseAssignProductDto(req.body),
        req.user!.id,
      );
      return ok<UserPlanOutDto>(res, "Product scheduled", data);
    } catch (error) {
      return fail(res, error, "Failed to schedule the product");
    }
  };

  endNow = async (req: Request, res: Response) => {
    try {
      const userId = parseRouteId(req.params.id);
      const productId = parseParam(req.params.productId, {
        label: "product id",
        objectId: true,
      });
      const data = await userProductService.endNow(userId, productId);
      return ok<UserPlanOutDto>(res, "Product stopped", data);
    } catch (error) {
      return fail(res, error, "Failed to stop the product");
    }
  };

  deletePeriod = async (req: Request, res: Response) => {
    try {
      const userId = parseRouteId(req.params.id);
      const periodId = parseParam(req.params.periodId, {
        label: "period id",
        objectId: true,
      });
      const data = await userProductService.deletePeriod(userId, periodId);
      return ok<UserPlanOutDto>(res, "Period deleted", data);
    } catch (error) {
      return fail(res, error, "Failed to delete the period");
    }
  };
}
