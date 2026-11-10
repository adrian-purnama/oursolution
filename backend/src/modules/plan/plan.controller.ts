import type { Request, Response } from "express";
import { ApiResponseDto } from "../../dto/apiResponse.dto";
import type { PlanOutDto, PricingPlanOutDto } from "../../dto/plan.dto";
import { parseRouteId } from "../../validation/parseParam";
import { parseCreatePlanDto, parseUpdatePlanDto } from "../../validation/plan";
import { planService } from "./plan.service";

function fail(res: Response, error: unknown, fallback: string) {
  return res.status(400).json({
    success: false,
    message: error instanceof Error ? error.message : fallback,
    data: null,
  } satisfies ApiResponseDto);
}

export class PlanController {
  /** Public: the plans marked to show on the pricing page. */
  listPricing = async (_req: Request, res: Response) => {
    try {
      const data = await planService.listPricing();
      return res.status(200).json({
        success: true,
        message: "Pricing retrieved",
        data,
      } satisfies ApiResponseDto<PricingPlanOutDto[]>);
    } catch (error) {
      return fail(res, error, "Failed to load pricing");
    }
  };

  list = async (_req: Request, res: Response) => {
    try {
      const data = await planService.list();
      return res.status(200).json({
        success: true,
        message: "Plans retrieved",
        data,
      } satisfies ApiResponseDto<PlanOutDto[]>);
    } catch (error) {
      return fail(res, error, "Failed to list plans");
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const data = await planService.create(parseCreatePlanDto(req.body));
      return res.status(201).json({
        success: true,
        message: "Plan created",
        data,
      } satisfies ApiResponseDto<PlanOutDto>);
    } catch (error) {
      return fail(res, error, "Failed to create plan");
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const id = parseRouteId(req.params.id);
      const data = await planService.update(id, parseUpdatePlanDto(req.body));
      return res.status(200).json({
        success: true,
        message: "Plan updated",
        data,
      } satisfies ApiResponseDto<PlanOutDto>);
    } catch (error) {
      return fail(res, error, "Failed to update plan");
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      await planService.delete(parseRouteId(req.params.id));
      return res.status(200).json({
        success: true,
        message: "Plan deleted",
        data: null,
      } satisfies ApiResponseDto);
    } catch (error) {
      return fail(res, error, "Failed to delete plan");
    }
  };
}
