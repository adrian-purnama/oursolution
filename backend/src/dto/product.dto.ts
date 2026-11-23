import type {
  ProductDeployment,
  ProductKind,
  ProductNotice,
  ProductVariant,
} from "../models/product/product.interface";
import type {
  DeploymentCheckResult,
  DeploymentDraft,
} from "../utils/deployment";

/** Body of the deployment check: the settings as typed. */
export type CheckDeploymentInDto = DeploymentDraft;

export type CheckDeploymentOutDto = DeploymentCheckResult;

/** One product image; `id` is what the reorder and delete calls take. */
export interface ProductImageOutDto {
  id: string;
  url: string;
}

export interface ProductOutDto {
  id: string;
  name: string;
  kind: ProductKind;
  color: string;
  /** The cover: the first of `images`. */
  imageUrl: string | null;
  /** In display order. */
  images: ProductImageOutDto[];
  pricingText: string;
  description: string;
  notices: ProductNotice[];
  priceIdr: number;
  /** Outside Indonesia, in US cents; null when not sold there. */
  priceUsdCents: number | null;
  /** Read-only: the Paddle price kept in step with `priceUsdCents`. */
  paddlePriceId: string | null;
  /** Read-only: the Paddle product holding the prices. */
  paddleProductId: string | null;
  /** Subscription only. */
  durationDays: number | null;
  /** Subscription only; admin-only. */
  deployment: ProductDeployment | null;
  /** Subscription only: the base variant's own name; "" uses the product's. */
  variantName: string;
  variantSpecs: string;
  /** Subscription only: variants besides the base one. */
  variants: ProductVariant[];
  /** One-time only; admins and owners see it, the pricing page never does. */
  accessUrl: string | null;
  showOnPricingPage: boolean;
  /** Set when soft deleted. */
  deletedAt: string | null;
}

/** What the public pricing page gets: no internal price, no access link. */
export interface PricingProductOutDto {
  id: string;
  name: string;
  kind: ProductKind;
  color: string;
  /** The cover: the first of `images`. */
  imageUrl: string | null;
  /** In display order. */
  images: ProductImageOutDto[];
  pricingText: string;
  description: string;
  notices: ProductNotice[];
  durationDays: number | null;
  /** What `price` and every variant's price are in, for this visitor. */
  currency: "IDR" | "USD";
  /**
   * The lowest price the visitor can pay, in `currency` (whole rupiah, or
   * US cents); null when it is not sold in their region.
   */
  price: number | null;
  /**
   * Subscription only: every variant, the base one first. Just the base
   * when the product has no others.
   */
  variants: PricingVariantOutDto[];
}

/**
 * A variant as the public sees it: no compose file. Its price is shown so
 * customers can compare variants; checkout charges the same.
 */
export interface PricingVariantOutDto {
  id: string;
  name: string;
  specs: string;
  /** Shown as its price once chosen; empty shows the price. */
  pricingText: string;
  /** Markdown shown once chosen: its own, else the product's. */
  description: string;
  /** In the product's `currency`: whole rupiah, or US cents. */
  price: number;
  durationDays: number | null;
}

/** The small form used wherever a product is only being labelled. */
export interface ProductSummaryDto {
  id: string;
  name: string;
  kind: ProductKind;
  color: string;
  /** The cover image. */
  imageUrl: string | null;
}

export interface CreateProductDto {
  name: string;
  kind: ProductKind;
  color: string;
  pricingText: string;
  description: string;
  notices: ProductNotice[];
  priceIdr: number;
  /** Outside Indonesia, in US cents; null when not sold there. */
  priceUsdCents: number | null;
  durationDays: number | null;
  deployment: ProductDeployment | null;
  variantName: string;
  variantSpecs: string;
  variants: ProductVariant[];
  accessUrl: string | null;
  showOnPricingPage: boolean;
}

/** The kind is fixed at creation. */
export type UpdateProductDto = Partial<Omit<CreateProductDto, "kind">>;

/** Body of the image reorder: every current image id, in the new order. */
export interface ReorderProductImagesDto {
  ids: string[];
}
