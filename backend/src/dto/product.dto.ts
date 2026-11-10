import type { ProductKind } from "../models/product/product.interface";

export interface ProductOutDto {
  id: string;
  name: string;
  kind: ProductKind;
  color: string;
  imageUrl: string | null;
  pricingText: string;
  priceIdr: number;
  /** Subscription only. */
  durationDays: number | null;
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
  imageUrl: string | null;
  pricingText: string;
  durationDays: number | null;
}

/** The small form used wherever a product is only being labelled. */
export interface ProductSummaryDto {
  id: string;
  name: string;
  kind: ProductKind;
  color: string;
  imageUrl: string | null;
}

export interface CreateProductDto {
  name: string;
  kind: ProductKind;
  color: string;
  pricingText: string;
  priceIdr: number;
  durationDays: number | null;
  accessUrl: string | null;
  showOnPricingPage: boolean;
}

/** The kind is fixed at creation. */
export type UpdateProductDto = Partial<Omit<CreateProductDto, "kind">>;
