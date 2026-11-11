import type {
  ProductDeployment,
  ProductKind,
} from "../models/product/product.interface";
import type {
  DeploymentCheckResult,
  DeploymentDraft,
} from "../utils/deployment";

/** Body of the deployment check: the settings as typed. */
export type CheckDeploymentInDto = DeploymentDraft;

export type CheckDeploymentOutDto = DeploymentCheckResult;

export interface ProductOutDto {
  id: string;
  name: string;
  kind: ProductKind;
  color: string;
  imageUrl: string | null;
  pricingText: string;
  description: string;
  priceIdr: number;
  /** Subscription only. */
  durationDays: number | null;
  /** Subscription only; admin-only. */
  deployment: ProductDeployment | null;
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
  description: string;
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
  description: string;
  priceIdr: number;
  durationDays: number | null;
  deployment: ProductDeployment | null;
  accessUrl: string | null;
  showOnPricingPage: boolean;
}

/** The kind is fixed at creation. */
export type UpdateProductDto = Partial<Omit<CreateProductDto, "kind">>;
