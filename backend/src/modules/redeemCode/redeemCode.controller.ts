import type { Request, Response } from "express";
import { ApiResponseDto } from "../../dto/apiResponse.dto";
import {
  REDEEM_CODE_GROUPS,
  type RedeemCodeGroup,
  type RedeemCodeListOutDto,
  type RedeemCodeOutDto,
  type RedeemResultOutDto,
} from "../../dto/redeemCode.dto";
import { parseRouteId } from "../../validation/parseParam";
import { parsePageQuery } from "../../validation/payment";
import {
  parseCreateRedeemCodesDto,
  parseRedeemCode,
} from "../../validation/redeemCode";
import { RedeemError, redeemCodeService } from "./redeemCode.service";

function fail(res: Response, error: unknown, fallback: string) {
  return res.status(error instanceof RedeemError ? 409 : 400).json({
    success: false,
    message: error instanceof Error ? error.message : fallback,
    data: null,
  } satisfies ApiResponseDto);
}

/** Admin: make, list and delete redeem codes. Users: redeem one. */
export class RedeemCodeController {
  list = async (req: Request, res: Response) => {
    try {
      const { page, pageSize } = parsePageQuery(req.query);
      const raw = req.query.status;
      const group: RedeemCodeGroup = REDEEM_CODE_GROUPS.includes(
        raw as RedeemCodeGroup,
      )
        ? (raw as RedeemCodeGroup)
        : "all";
      const data = await redeemCodeService.list(group, page, pageSize);
      return res.status(200).json({
        success: true,
        message: "Redeem codes retrieved",
        data,
      } satisfies ApiResponseDto<RedeemCodeListOutDto>);
    } catch (error) {
      return fail(res, error, "Failed to load redeem codes");
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const data = await redeemCodeService.create(
        parseCreateRedeemCodesDto(req.body),
        req.user!.id,
      );
      return res.status(201).json({
        success: true,
        message:
          data.length === 1 ? "Code created" : `${data.length} codes created`,
        data,
      } satisfies ApiResponseDto<RedeemCodeOutDto[]>);
    } catch (error) {
      return fail(res, error, "Failed to create codes");
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      await redeemCodeService.remove(parseRouteId(req.params.id));
      return res.status(200).json({
        success: true,
        message: "Code deleted",
        data: null,
      } satisfies ApiResponseDto);
    } catch (error) {
      return fail(res, error, "Failed to delete the code");
    }
  };

  redeem = async (req: Request, res: Response) => {
    try {
      const data = await redeemCodeService.redeem(
        req.user!.id,
        parseRedeemCode(req.body),
      );
      return res.status(200).json({
        success: true,
        message: `${data.product.name} redeemed`,
        data,
      } satisfies ApiResponseDto<RedeemResultOutDto>);
    } catch (error) {
      return fail(res, error, "Failed to redeem the code");
    }
  };
}
