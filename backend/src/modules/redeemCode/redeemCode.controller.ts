import type { Request, Response } from "express";
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
import { redeemCodeService } from "./redeemCode.service";
import { fail, ok } from "../../utils/respond";

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
      return ok<RedeemCodeListOutDto>(res, "Redeem codes retrieved", data);
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
      return ok<RedeemCodeOutDto[]>(
        res,
        data.length === 1 ? "Code created" : `${data.length} codes created`,
        data,
        201,
      );
    } catch (error) {
      return fail(res, error, "Failed to create codes");
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      await redeemCodeService.remove(parseRouteId(req.params.id));
      return ok(res, "Code deleted", null);
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
      return ok<RedeemResultOutDto>(res, `${data.product.name} redeemed`, data);
    } catch (error) {
      return fail(res, error, "Failed to redeem the code");
    }
  };
}
