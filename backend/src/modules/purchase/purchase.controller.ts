import type { Request, Response } from "express";
import { ApiResponseDto } from "../../dto/apiResponse.dto";
import type { PurchaseOutDto } from "../../dto/purchase.dto";
import { parseParam, parseRouteId } from "../../validation/parseParam";
import { parseGrantPurchaseInDto } from "../../validation/product";
import { AlreadyOwnedError, purchaseService } from "./purchase.service";

function ok(res: Response, message: string, data: PurchaseOutDto[]) {
  return res.status(200).json({
    success: true,
    message,
    data,
  } satisfies ApiResponseDto<PurchaseOutDto[]>);
}

function fail(res: Response, error: unknown, fallback: string) {
  return res.status(error instanceof AlreadyOwnedError ? 409 : 400).json({
    success: false,
    message: error instanceof Error ? error.message : fallback,
    data: null,
  } satisfies ApiResponseDto);
}

/** One-time products a user owns: their own list, and admin grants and revokes. */
export class PurchaseController {
  listOwn = async (req: Request, res: Response) => {
    try {
      return ok(
        res,
        "Your purchases retrieved",
        await purchaseService.listOwned(req.user!.id),
      );
    } catch (error) {
      return fail(res, error, "Failed to load your purchases");
    }
  };

  list = async (req: Request, res: Response) => {
    try {
      const userId = parseRouteId(req.params.id);
      return ok(
        res,
        "Purchases retrieved",
        await purchaseService.listOwned(userId),
      );
    } catch (error) {
      return fail(res, error, "Failed to load purchases");
    }
  };

  grant = async (req: Request, res: Response) => {
    try {
      const userId = parseRouteId(req.params.id);
      const { productId } = parseGrantPurchaseInDto(req.body);
      const data = await purchaseService.grantByAdmin(
        userId,
        productId,
        req.user!.id,
      );
      return ok(res, "Product given", data);
    } catch (error) {
      return fail(res, error, "Failed to give the product");
    }
  };

  revoke = async (req: Request, res: Response) => {
    try {
      const userId = parseRouteId(req.params.id);
      const purchaseId = parseParam(req.params.purchaseId, {
        label: "purchase id",
        objectId: true,
      });
      const data = await purchaseService.revoke(userId, purchaseId);
      return ok(res, "Product taken back", data);
    } catch (error) {
      return fail(res, error, "Failed to take the product back");
    }
  };
}
