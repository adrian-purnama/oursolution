import type { Request, Response } from "express";
import type { PurchaseOutDto } from "../../dto/purchase.dto";
import { parseParam, parseRouteId } from "../../validation/parseParam";
import { parseGrantPurchaseInDto } from "../../validation/product";
import { purchaseService } from "./purchase.service";
import { fail, ok } from "../../utils/respond";

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
      return ok<PurchaseOutDto[]>(res, "Product given", data);
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
      return ok<PurchaseOutDto[]>(res, "Product taken back", data);
    } catch (error) {
      return fail(res, error, "Failed to take the product back");
    }
  };
}
