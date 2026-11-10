import type { Request, Response } from "express";
import { ApiResponseDto } from "../../dto/apiResponse.dto";
import type { UserPlanOutDto } from "../../dto/userProduct.dto";
import { parseParam, parseRouteId } from "../../validation/parseParam";
import { parseAssignProductDto } from "../../validation/product";
import { PlanScheduleError } from "./userProduct.planner";
import { userProductService } from "./userProduct.service";

function ok(res: Response, message: string, data: UserPlanOutDto) {
  return res.status(200).json({
    success: true,
    message,
    data,
  } satisfies ApiResponseDto<UserPlanOutDto>);
}

function fail(res: Response, error: unknown, fallback: string) {
  // A scheduling conflict is a clash with existing data, not a malformed request.
  return res.status(error instanceof PlanScheduleError ? 409 : 400).json({
    success: false,
    message: error instanceof Error ? error.message : fallback,
    data: null,
  } satisfies ApiResponseDto);
}

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
      return ok(res, "Product started", data);
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
      return ok(res, "Product scheduled", data);
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
      return ok(res, "Product stopped", data);
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
      return ok(res, "Period deleted", data);
    } catch (error) {
      return fail(res, error, "Failed to delete the period");
    }
  };
}
