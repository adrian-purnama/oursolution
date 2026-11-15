import type { Request, Response } from "express";
import { ApiResponseDto } from "../../dto/apiResponse.dto";
import type { CheckoutQuoteOutDto } from "../../dto/payment.dto";
import { parseParam } from "../../validation/parseParam";
import {
  parseBasketAddInDto,
  parseBasketQuantityInDto,
} from "../../validation/payment";
import { basketService } from "./basket.service";

function ok(res: Response, message: string, data: CheckoutQuoteOutDto) {
  return res.status(200).json({
    success: true,
    message,
    data,
  } satisfies ApiResponseDto<CheckoutQuoteOutDto>);
}

function fail(res: Response, error: unknown, fallback: string) {
  return res.status(400).json({
    success: false,
    message: error instanceof Error ? error.message : fallback,
    data: null,
  } satisfies ApiResponseDto);
}

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
      return ok(res, "Basket retrieved", await basketService.get(req.user!.id));
    } catch (error) {
      return fail(res, error, "Failed to load the basket");
    }
  };

  add = async (req: Request, res: Response) => {
    try {
      const { productId, quantity } = parseBasketAddInDto(req.body);
      return ok(
        res,
        "Added to basket",
        await basketService.add(req.user!.id, productId, quantity),
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
        await basketService.setQuantity(
          req.user!.id,
          productIdParam(req),
          parseBasketQuantityInDto(req.body),
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
      return ok(res, "Basket emptied", await basketService.clear(req.user!.id));
    } catch (error) {
      return fail(res, error, "Could not empty the basket");
    }
  };
}
