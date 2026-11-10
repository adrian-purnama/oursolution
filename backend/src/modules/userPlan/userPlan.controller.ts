import type { Request, Response } from "express";
import { ApiResponseDto } from "../../dto/apiResponse.dto";
import type { UserPlanOverviewOutDto } from "../../dto/userPlan.dto";
import { parseParam, parseRouteId } from "../../validation/parseParam";
import { parseAssignPlanDto } from "../../validation/plan";
import { PlanScheduleError } from "./userPlan.planner";
import { userPlanService } from "./userPlan.service";

function ok(res: Response, message: string, data: UserPlanOverviewOutDto) {
  return res.status(200).json({
    success: true,
    message,
    data,
  } satisfies ApiResponseDto<UserPlanOverviewOutDto>);
}

function fail(res: Response, error: unknown, fallback: string) {
  // A scheduling conflict is a clash with existing data, not a malformed request.
  return res.status(error instanceof PlanScheduleError ? 409 : 400).json({
    success: false,
    message: error instanceof Error ? error.message : fallback,
    data: null,
  } satisfies ApiResponseDto);
}

/** Plan timeline endpoints: the signed-in user's own, and admin actions on any user's. */
export class UserPlanController {
  getOwnOverview = async (req: Request, res: Response) => {
    try {
      return ok(
        res,
        "Your plan retrieved",
        await userPlanService.getOverview(req.user!.id),
      );
    } catch (error) {
      return fail(res, error, "Failed to load your plan");
    }
  };

  getOverview = async (req: Request, res: Response) => {
    try {
      const userId = parseRouteId(req.params.id);
      return ok(
        res,
        "User plan retrieved",
        await userPlanService.getOverview(userId),
      );
    } catch (error) {
      return fail(res, error, "Failed to load the user's plan");
    }
  };

  overrideNow = async (req: Request, res: Response) => {
    try {
      const userId = parseRouteId(req.params.id);
      const data = await userPlanService.overrideNow(
        userId,
        parseAssignPlanDto(req.body),
        req.user!.id,
      );
      return ok(res, "Plan changed", data);
    } catch (error) {
      return fail(res, error, "Failed to change the plan");
    }
  };

  scheduleNext = async (req: Request, res: Response) => {
    try {
      const userId = parseRouteId(req.params.id);
      const data = await userPlanService.scheduleNext(
        userId,
        parseAssignPlanDto(req.body),
        req.user!.id,
      );
      return ok(res, "Plan scheduled", data);
    } catch (error) {
      return fail(res, error, "Failed to schedule the plan");
    }
  };

  deleteScheduled = async (req: Request, res: Response) => {
    try {
      const userId = parseRouteId(req.params.id);
      const periodId = parseParam(req.params.periodId, {
        label: "period id",
        objectId: true,
      });
      const data = await userPlanService.deleteScheduled(userId, periodId);
      return ok(res, "Scheduled plan deleted", data);
    } catch (error) {
      return fail(res, error, "Failed to delete the scheduled plan");
    }
  };
}
