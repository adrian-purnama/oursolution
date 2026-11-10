import type { HydratedDocument } from "mongoose";
import {
  deletePublicFile,
  publicFileUrl,
  updatePublicFile,
} from "../../buckets/publicBucket";
import type {
  CreateProductDto,
  PricingProductOutDto,
  ProductOutDto,
  ProductSummaryDto,
  UpdateProductDto,
} from "../../dto/product.dto";
import type { ProductInterface } from "../../models/product/product.interface";
import { ProductModel } from "../../models/product/product.model";
import { PaymentModel } from "../../models/payment/payment.model";
import { PurchaseModel } from "../../models/purchase/purchase.model";
import { UserProductPeriodModel } from "../../models/userProductPeriod/userProductPeriod.model";
import { normalizeImage } from "../../utils/image";

export type ProductDoc = HydratedDocument<ProductInterface>;

export function toProductOut(product: ProductDoc): ProductOutDto {
  return {
    id: product.id,
    name: product.name,
    kind: product.kind,
    color: product.color,
    imageUrl: publicFileUrl(product.image),
    pricingText: product.pricingText,
    priceIdr: product.priceIdr,
    durationDays: product.durationDays,
    accessUrl: product.accessUrl,
    showOnPricingPage: product.showOnPricingPage,
  };
}

export function toProductSummary(product: ProductDoc): ProductSummaryDto {
  return {
    id: product.id,
    name: product.name,
    kind: product.kind,
    color: product.color,
    imageUrl: publicFileUrl(product.image),
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === 11000
  );
}

function rethrowDuplicate(error: unknown): never {
  if (isDuplicateKeyError(error)) {
    throw new Error("A product with this name already exists");
  }
  throw error;
}

export class ProductService {
  async list(): Promise<ProductOutDto[]> {
    const products = await ProductModel.find()
      .sort({ priceIdr: 1, name: 1 })
      .exec();
    return products.map(toProductOut);
  }

  async listPricing(): Promise<PricingProductOutDto[]> {
    const products = await ProductModel.find({ showOnPricingPage: true })
      .sort({ priceIdr: 1, name: 1 })
      .exec();
    return products.map((product) => ({
      id: product.id,
      name: product.name,
      kind: product.kind,
      color: product.color,
      imageUrl: publicFileUrl(product.image),
      pricingText: product.pricingText,
      durationDays: product.durationDays,
    }));
  }

  async get(id: string): Promise<ProductDoc> {
    const product = await ProductModel.findById(id).exec();
    if (!product) throw new Error("Product not found");
    return product;
  }

  async create(input: CreateProductDto): Promise<ProductOutDto> {
    try {
      return toProductOut(await ProductModel.create(input));
    } catch (error) {
      rethrowDuplicate(error);
    }
  }

  async update(id: string, patch: UpdateProductDto): Promise<ProductOutDto> {
    const product = await this.get(id);
    product.set(patch);
    try {
      await product.save();
    } catch (error) {
      rethrowDuplicate(error);
    }
    return toProductOut(product);
  }

  /** Replace the product's public image; the old file is removed afterwards. */
  async changeImage(id: string, buffer: Buffer): Promise<ProductOutDto> {
    const product = await this.get(id);
    // Re-encoding strips anything that is not pixel data (scripts in SVG,
    // polyglot files) and ignores the client-supplied content type.
    const image = await normalizeImage(buffer);

    const uploaded = await updatePublicFile({
      oldId: product.image,
      buffer: image.buffer,
      filename: `product-${product.id}.png`,
      contentType: image.contentType,
      metadata: { kind: "productImage", productId: product.id },
      onReplace: async (newId, session) => {
        await ProductModel.updateOne(
          { _id: product._id },
          { $set: { image: newId } },
          { session },
        );
      },
    });

    product.image = uploaded.id;
    return toProductOut(product);
  }

  async delete(id: string): Promise<void> {
    const product = await this.get(id);

    const [periods, purchases, payments] = await Promise.all([
      UserProductPeriodModel.countDocuments({ productId: product._id }).exec(),
      PurchaseModel.countDocuments({ productId: product._id }).exec(),
      PaymentModel.countDocuments({ productId: product._id }).exec(),
    ]);
    if (periods + purchases + payments > 0) {
      throw new Error(
        "Users have had, bought or paid for this product, so it cannot be deleted. Hide it from the pricing page instead.",
      );
    }

    await product.deleteOne();
    if (product.image) await deletePublicFile(product.image);
  }
}

export const productService = new ProductService();
