import type { Request, Response } from "express";
import { ApiResponseDto } from "../../dto/apiResponse.dto";
import type {
  PricingProductOutDto,
  ProductOutDto,
} from "../../dto/product.dto";
import { parseRouteId } from "../../validation/parseParam";
import {
  parseCreateProductDto,
  parseUpdateProductDto,
} from "../../validation/product";
import { productService } from "./product.service";

function fail(res: Response, error: unknown, fallback: string) {
  return res.status(400).json({
    success: false,
    message: error instanceof Error ? error.message : fallback,
    data: null,
  } satisfies ApiResponseDto);
}

function ok<T>(res: Response, status: number, message: string, data: T) {
  return res.status(status).json({
    success: true,
    message,
    data,
  } satisfies ApiResponseDto<T>);
}

export class ProductController {
  /** Public: the products listed on the pricing page. */
  listPricing = async (_req: Request, res: Response) => {
    try {
      const data = await productService.listPricing();
      return ok<PricingProductOutDto[]>(res, 200, "Pricing retrieved", data);
    } catch (error) {
      return fail(res, error, "Failed to load pricing");
    }
  };

  list = async (_req: Request, res: Response) => {
    try {
      const data = await productService.list();
      return ok<ProductOutDto[]>(res, 200, "Products retrieved", data);
    } catch (error) {
      return fail(res, error, "Failed to list products");
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const data = await productService.create(parseCreateProductDto(req.body));
      return ok<ProductOutDto>(res, 201, "Product created", data);
    } catch (error) {
      return fail(res, error, "Failed to create product");
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const id = parseRouteId(req.params.id);
      const product = await productService.get(id);
      const data = await productService.update(
        id,
        parseUpdateProductDto(req.body, product.kind),
      );
      return ok<ProductOutDto>(res, 200, "Product updated", data);
    } catch (error) {
      return fail(res, error, "Failed to update product");
    }
  };

  updateImage = async (req: Request, res: Response) => {
    try {
      const id = parseRouteId(req.params.id);
      if (!req.file) throw new Error("file required");
      const data = await productService.changeImage(id, req.file.buffer);
      return ok<ProductOutDto>(res, 200, "Product image updated", data);
    } catch (error) {
      return fail(res, error, "Failed to update the product image");
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      await productService.delete(parseRouteId(req.params.id));
      return ok(res, 200, "Product deleted", null);
    } catch (error) {
      return fail(res, error, "Failed to delete product");
    }
  };
}
