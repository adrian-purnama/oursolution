import type { RedeemActivation } from "../models/redeemCode/redeemCode.interface";
import type { ProductSummaryDto } from "./product.dto";

export const REDEEM_CODE_GROUPS = [
  "all",
  "available",
  "redeemed",
  "expired",
] as const;
export type RedeemCodeGroup = (typeof REDEEM_CODE_GROUPS)[number];

export interface RedeemCodeUserDto {
  id: string;
  email: string;
}

export interface RedeemCodeOutDto {
  id: string;
  code: string;
  /** null when the product was erased. */
  product: ProductSummaryDto | null;
  activation: RedeemActivation;
  activatesAt: string | null;
  durationDays: number | null;
  endsAt: string | null;
  validUntil: string | null;
  status: Exclude<RedeemCodeGroup, "all">;
  createdAt: string;
  createdBy: RedeemCodeUserDto | null;
  redeemedAt: string | null;
  redeemedBy: RedeemCodeUserDto | null;
}

export interface RedeemCodeListOutDto {
  items: RedeemCodeOutDto[];
  page: number;
  pageSize: number;
  total: number;
  counts: Record<RedeemCodeGroup, number>;
}

export interface CreateRedeemCodesInDto {
  productId: string;
  activation: RedeemActivation;
  activatesAt: Date | null;
  durationDays: number | null;
  endsAt: Date | null;
  validUntil: Date | null;
  quantity: number;
}

/** What the redeemer got. */
export interface RedeemResultOutDto {
  product: ProductSummaryDto;
  /** For a one-time product: when it became theirs. */
  startsAt: string;
  /** null for a one-time product. */
  endsAt: string | null;
}
