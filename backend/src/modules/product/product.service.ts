import { Types, type HydratedDocument } from "mongoose";
import {
  deletePublicFile,
  publicFileUrl,
  updatePublicFile,
} from "../../buckets/publicBucket";
import type {
  CreateProductDto,
  PricingProductOutDto,
  ProductImageOutDto,
  ProductOutDto,
  ProductSummaryDto,
  UpdateProductDto,
} from "../../dto/product.dto";
import {
  MAX_PRODUCT_IMAGES,
  type ProductInterface,
  type ProductNotice,
} from "../../models/product/product.interface";
import { ProductModel } from "../../models/product/product.model";
import { PaymentModel } from "../../models/payment/payment.model";
import { PurchaseModel } from "../../models/purchase/purchase.model";
import { UserProductPeriodModel } from "../../models/userProductPeriod/userProductPeriod.model";
import { env } from "../../environment/env";
import { normalizeImage } from "../../utils/image";

export type ProductDoc = HydratedDocument<ProductInterface>;

export class ProductNotFoundError extends Error {
  constructor() {
    super("Product not found");
  }
}

/** Plain copies: products saved before notices existed have none. */
export function noticesOf(product: ProductDoc): ProductNotice[] {
  return (product.notices ?? []).map(({ tone, text }) => ({ tone, text }));
}

/** The product's images in display order. */
export function imagesOf(product: ProductDoc): ProductImageOutDto[] {
  return (product.images ?? []).map((id) => ({
    id: id.toString(),
    url: publicFileUrl(id) as string,
  }));
}

/** The cover image: the first one. */
function coverUrl(product: ProductDoc): string | null {
  return publicFileUrl(product.images?.[0] ?? null);
}

/**
 * The current image ids in the order given. `ids` must name every current
 * image exactly once, so a stale page cannot drop or duplicate one.
 */
export function reorderImageIds(current: string[], ids: string[]): string[] {
  const same =
    ids.length === current.length &&
    new Set(ids).size === ids.length &&
    ids.every((id) => current.includes(id));
  if (!same) {
    throw new Error(
      "The images changed since the page loaded; reload and try again",
    );
  }
  return ids;
}

/** The public shape: no internal price, deployment or access link. */
export function toPricingProductOut(product: ProductDoc): PricingProductOutDto {
  return {
    id: product.id,
    name: product.name,
    kind: product.kind,
    color: product.color,
    imageUrl: coverUrl(product),
    images: imagesOf(product),
    pricingText: product.pricingText,
    description: product.description,
    notices: noticesOf(product),
    durationDays: product.durationDays,
  };
}

export function toProductOut(product: ProductDoc): ProductOutDto {
  return {
    id: product.id,
    name: product.name,
    kind: product.kind,
    color: product.color,
    imageUrl: coverUrl(product),
    images: imagesOf(product),
    pricingText: product.pricingText,
    description: product.description,
    notices: noticesOf(product),
    priceIdr: product.priceIdr,
    durationDays: product.durationDays,
    deployment: product.deployment
      ? {
          type: product.deployment.type,
          projectId: product.deployment.projectId,
          name: product.deployment.name,
          composeFile: product.deployment.composeFile,
          variables: product.deployment.variables.map(
            ({ key, value, visibility }) => ({ key, value, visibility }),
          ),
          domains: product.deployment.domains.map(
            ({ serviceName, subdomain, port }) => ({
              serviceName,
              subdomain,
              port,
            }),
          ),
        }
      : null,
    accessUrl: product.accessUrl,
    showOnPricingPage: product.showOnPricingPage,
    deletedAt: product.deletedAt?.toISOString() ?? null,
  };
}

export function toProductSummary(product: ProductDoc): ProductSummaryDto {
  return {
    id: product.id,
    name: product.name,
    kind: product.kind,
    color: product.color,
    imageUrl: coverUrl(product),
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
    throw new Error(
      "A product with this name already exists (it may be deleted: restore or rename it)",
    );
  }
  throw error;
}

/**
 * Why a product cannot be soft deleted right now, or null when it can.
 * A subscription must not be running or scheduled for anyone; a one-time
 * product can always go, since owners keep it.
 */
export function softDeleteBlocker(
  kind: ProductInterface["kind"],
  livePeriods: number,
): string | null {
  if (kind === "subscription" && livePeriods > 0) {
    return `${livePeriods} running or scheduled period(s) still use this subscription. Stop or delete them on the users' plans first.`;
  }
  return null;
}

/** Running or scheduled at `now`. */
function liveFilter(now: Date) {
  return { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] };
}

/**
 * The subdomain part of a full host saved before domains were split:
 * "n8n-${USERNAME}.example.com" gives "n8n-${USERNAME}" when the deploy
 * domain is example.com, else everything before the first dot.
 */
export function subdomainFromHost(host: string, domain: string | null): string {
  const value = host.trim();
  if (domain && value.endsWith(`.${domain}`)) {
    return value.slice(0, -(domain.length + 1));
  }
  return value.split(".")[0] ?? "";
}

export class ProductService {
  /**
   * Products saved when a domain held a full `host` get a `subdomain`
   * instead. Runs at startup; returns how many products it changed.
   */
  async migrateLegacyDomains(): Promise<number> {
    type LegacyDomain = {
      serviceName?: string;
      host?: string;
      subdomain?: string;
      port?: number;
    };
    const legacy = await ProductModel.collection
      .find<{ _id: Types.ObjectId; deployment: { domains: LegacyDomain[] } }>({
        "deployment.domains.host": { $exists: true },
      })
      .toArray();
    for (const product of legacy) {
      const domains = product.deployment.domains.map((item) => ({
        serviceName: item.serviceName ?? "",
        subdomain:
          item.subdomain ??
          subdomainFromHost(item.host ?? "", env.deployDomain),
        port: item.port ?? 0,
      }));
      await ProductModel.collection.updateOne(
        { _id: product._id },
        { $set: { "deployment.domains": domains } },
      );
    }
    return legacy.length;
  }

  /**
   * Products saved with a single `image` get it as the first of `images`.
   * Runs at startup; returns how many products it changed.
   */
  async migrateLegacyImages(): Promise<number> {
    const legacy = await ProductModel.collection
      .find<{
        _id: Types.ObjectId;
        image: Types.ObjectId | null;
        images?: Types.ObjectId[];
      }>({ image: { $exists: true } })
      .toArray();
    for (const product of legacy) {
      const images = product.images ?? [];
      const old = product.image;
      if (old && !images.some((id) => id.equals(old))) images.unshift(old);
      await ProductModel.collection.updateOne(
        { _id: product._id },
        { $set: { images }, $unset: { image: "" } },
      );
    }
    return legacy.length;
  }

  async list(): Promise<ProductOutDto[]> {
    const products = await ProductModel.find()
      .sort({ priceIdr: 1, name: 1 })
      .exec();
    return products.map(toProductOut);
  }

  async listPricing(): Promise<PricingProductOutDto[]> {
    const products = await ProductModel.find({
      showOnPricingPage: true,
      deletedAt: null,
    })
      .sort({ priceIdr: 1, name: 1 })
      .exec();
    return products.map(toPricingProductOut);
  }

  /** Public: one product, only while it is published and not deleted. */
  async getPricing(id: string): Promise<PricingProductOutDto> {
    const product = await ProductModel.findOne({
      _id: id,
      showOnPricingPage: true,
      deletedAt: null,
    }).exec();
    if (!product) throw new ProductNotFoundError();
    return toPricingProductOut(product);
  }

  async get(id: string): Promise<ProductDoc> {
    const product = await ProductModel.findById(id).exec();
    if (!product) throw new Error("Product not found");
    return product;
  }

  /** A product that is not deleted, for checkout and admin assignment. */
  async getAvailable(id: string): Promise<ProductDoc> {
    const product = await this.get(id);
    if (product.deletedAt) throw new Error("This product has been deleted");
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

  /** Add an image after the others; the first one stays the cover. */
  async addImage(id: string, buffer: Buffer): Promise<ProductOutDto> {
    const product = await this.get(id);
    const full = `A product can have at most ${MAX_PRODUCT_IMAGES} images`;
    if (product.images.length >= MAX_PRODUCT_IMAGES) throw new Error(full);
    // Re-encoding strips anything that is not pixel data (scripts in SVG,
    // polyglot files) and ignores the client-supplied content type.
    const image = await normalizeImage(buffer);

    await updatePublicFile({
      buffer: image.buffer,
      filename: `product-${product.id}.png`,
      contentType: image.contentType,
      metadata: { kind: "productImage", productId: product.id },
      onReplace: async (newId, session) => {
        // Checked again here so two uploads at once cannot pass the limit.
        const result = await ProductModel.updateOne(
          {
            _id: product._id,
            [`images.${MAX_PRODUCT_IMAGES - 1}`]: { $exists: false },
          },
          { $push: { images: newId } },
          { session },
        );
        if (result.modifiedCount === 0) throw new Error(full);
      },
    });

    return toProductOut(await this.get(id));
  }

  /** Put the images in a new order; the first becomes the cover. */
  async reorderImages(id: string, ids: string[]): Promise<ProductOutDto> {
    const product = await this.get(id);
    const order = reorderImageIds(
      product.images.map((image) => image.toString()),
      ids,
    );
    product.images = order.map((image) => new Types.ObjectId(image));
    await product.save();
    return toProductOut(product);
  }

  /** Remove one image and its file. */
  async removeImage(id: string, imageId: string): Promise<ProductOutDto> {
    const product = await this.get(id);
    const image = product.images.find((item) => item.toString() === imageId);
    if (!image) throw new Error("Image not found");

    await ProductModel.updateOne(
      { _id: product._id },
      { $pull: { images: image } },
    );
    await deletePublicFile(image);
    return toProductOut(await this.get(id));
  }

  /** Hide a product everywhere new; existing owners keep it. Can be restored. */
  async softDelete(id: string, now: Date = new Date()): Promise<ProductOutDto> {
    const product = await this.get(id);
    if (product.deletedAt) return toProductOut(product);

    const livePeriods = await UserProductPeriodModel.countDocuments({
      productId: product._id,
      ...liveFilter(now),
    }).exec();
    const blocker = softDeleteBlocker(product.kind, livePeriods);
    if (blocker) throw new Error(blocker);

    product.deletedAt = now;
    await product.save();
    return toProductOut(product);
  }

  async restore(id: string): Promise<ProductOutDto> {
    const product = await this.get(id);
    product.deletedAt = null;
    await product.save();
    return toProductOut(product);
  }

  /** Remove a deleted product for good, only when nothing refers to it. */
  async deletePermanently(id: string): Promise<void> {
    const product = await this.get(id);
    if (!product.deletedAt) {
      throw new Error(
        "Delete the product first; only deleted products can be removed for good",
      );
    }

    const [periods, purchases, payments] = await Promise.all([
      UserProductPeriodModel.countDocuments({ productId: product._id }).exec(),
      PurchaseModel.countDocuments({ productId: product._id }).exec(),
      PaymentModel.countDocuments({
        "items.productId": product._id,
      }).exec(),
    ]);
    if (periods + purchases + payments > 0) {
      throw new Error(
        `Still referenced by ${periods} period(s), ${purchases} purchase(s) and ${payments} payment(s), so it can only stay deleted, not be removed for good.`,
      );
    }

    await product.deleteOne();
    for (const image of product.images) await deletePublicFile(image);
  }
}

export const productService = new ProductService();
