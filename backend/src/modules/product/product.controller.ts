import type { Request, Response } from "express";
import { regionForRequest } from "../payment/billingRegion";
import type {
  CheckDeploymentOutDto,
  PricingProductOutDto,
  ProductOutDto,
} from "../../dto/product.dto";
import { env } from "../../environment/env";
import { checkDeployment } from "../../utils/deployment";
import { parseParam, parseRouteId } from "../../validation/parseParam";
import {
  parseDeploymentDraft,
  parseCreateProductDto,
  parseReorderImagesDto,
  parseUpdateProductDto,
} from "../../validation/product";
import {
  ProductNotFoundError,
  productService,
  toProductOut,
} from "./product.service";
import { fail, ok, refuse } from "../../utils/respond";

export class ProductController {
  /** Public: the products listed on the pricing page. */
  /** Public: priced for where the visitor is (see billingRegion.ts). */
  listPricing = async (req: Request, res: Response) => {
    try {
      const data = await productService.listPricing(
        await regionForRequest(req),
      );
      return ok<PricingProductOutDto[]>(res, "Pricing retrieved", data);
    } catch (error) {
      return fail(res, error, "Failed to load pricing");
    }
  };

  /** Public: one published product, for its own page. */
  getPricing = async (req: Request, res: Response) => {
    try {
      const data = await productService.getPricing(
        parseRouteId(req.params.id),
        await regionForRequest(req),
      );
      return ok<PricingProductOutDto>(res, "Product retrieved", data);
    } catch (error) {
      if (error instanceof ProductNotFoundError) {
        return refuse(res, 404, error.message);
      }
      return fail(res, error, "Failed to load product");
    }
  };

  list = async (_req: Request, res: Response) => {
    try {
      const data = await productService.list();
      return ok<ProductOutDto[]>(res, "Products retrieved", data);
    } catch (error) {
      return fail(res, error, "Failed to list products");
    }
  };

  get = async (req: Request, res: Response) => {
    try {
      const product = await productService.get(parseRouteId(req.params.id));
      return ok<ProductOutDto>(res, "Product retrieved", toProductOut(product));
    } catch (error) {
      return fail(res, error, "Failed to load product");
    }
  };

  /** Checks deployment settings without saving anything. */
  checkDeployment = (req: Request, res: Response) => {
    try {
      const data = checkDeployment(
        parseDeploymentDraft(req.body),
        env.deployDomain ?? undefined,
      );
      return ok<CheckDeploymentOutDto>(res, "Deployment checked", data);
    } catch (error) {
      return fail(res, error, "Failed to check the deployment");
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const data = await productService.create(parseCreateProductDto(req.body));
      return ok<ProductOutDto>(res, "Product created", data, 201);
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
      return ok<ProductOutDto>(res, "Product updated", data);
    } catch (error) {
      return fail(res, error, "Failed to update product");
    }
  };

  addImage = async (req: Request, res: Response) => {
    try {
      const id = parseRouteId(req.params.id);
      if (!req.file) throw new Error("file required");
      const data = await productService.addImage(id, req.file.buffer);
      return ok<ProductOutDto>(res, "Product image added", data, 201);
    } catch (error) {
      return fail(res, error, "Failed to add the product image");
    }
  };

  reorderImages = async (req: Request, res: Response) => {
    try {
      const id = parseRouteId(req.params.id);
      const { ids } = parseReorderImagesDto(req.body);
      const data = await productService.reorderImages(id, ids);
      return ok<ProductOutDto>(res, "Product images reordered", data);
    } catch (error) {
      return fail(res, error, "Failed to reorder the product images");
    }
  };

  removeImage = async (req: Request, res: Response) => {
    try {
      const id = parseRouteId(req.params.id);
      const imageId = parseParam(req.params.imageId, {
        label: "image id",
        objectId: true,
      });
      const data = await productService.removeImage(id, imageId);
      return ok<ProductOutDto>(res, "Product image removed", data);
    } catch (error) {
      return fail(res, error, "Failed to remove the product image");
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      const data = await productService.softDelete(parseRouteId(req.params.id));
      return ok<ProductOutDto>(res, "Product deleted", data);
    } catch (error) {
      return fail(res, error, "Failed to delete product");
    }
  };

  restore = async (req: Request, res: Response) => {
    try {
      const data = await productService.restore(parseRouteId(req.params.id));
      return ok<ProductOutDto>(res, "Product restored", data);
    } catch (error) {
      return fail(res, error, "Failed to restore product");
    }
  };

  removePermanently = async (req: Request, res: Response) => {
    try {
      await productService.deletePermanently(parseRouteId(req.params.id));
      return ok(res, "Product removed for good", null);
    } catch (error) {
      return fail(res, error, "Failed to remove product");
    }
  };
}
