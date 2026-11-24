import type { Request, Response } from "express";
import type { CheckoutQuoteOutDto } from "../../dto/payment.dto";
import { parseParam } from "../../validation/parseParam";
import {
  parseBasketAddInDto,
  parseBasketLinePatchInDto,
} from "../../validation/payment";
import { basketService } from "./basket.service";
import { fail, ok } from "../../utils/respond";

function productIdParam(req: Request): string {
  return parseParam(req.params.productId, {
    label: "product id",
    objectId: true,
  });
}

/** The signed-in user's basket. */
export class BasketController {
  get = async (req: Request, res: Response) => {
    try {
      return ok<CheckoutQuoteOutDto>(
        res,
        "Basket retrieved",
        await basketService.get(req.user!.id),
      );
    } catch (error) {
      return fail(res, error, "Failed to load the basket");
    }
  };

  add = async (req: Request, res: Response) => {
    try {
      return ok(
        res,
        "Added to basket",
        await basketService.add(req.user!.id, parseBasketAddInDto(req.body)),
      );
    } catch (error) {
      return fail(res, error, "Could not add to the basket");
    }
  };

  setQuantity = async (req: Request, res: Response) => {
    try {
      return ok(
        res,
        "Basket updated",
        await basketService.updateLine(
          req.user!.id,
          productIdParam(req),
          parseBasketLinePatchInDto(req.body),
        ),
      );
    } catch (error) {
      return fail(res, error, "Could not update the basket");
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      return ok(
        res,
        "Removed from basket",
        await basketService.remove(req.user!.id, [productIdParam(req)]),
      );
    } catch (error) {
      return fail(res, error, "Could not update the basket");
    }
  };

  clear = async (req: Request, res: Response) => {
    try {
      return ok<CheckoutQuoteOutDto>(
        res,
        "Basket emptied",
        await basketService.clear(req.user!.id),
      );
    } catch (error) {
      return fail(res, error, "Could not empty the basket");
    }
  };
}
