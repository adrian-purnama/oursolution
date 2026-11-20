import { Types } from "mongoose";
import type { CheckoutPlacement } from "../payment/payment.interface";
import type { VariantApplyMode } from "../userProductPeriod/userProductPeriod.interface";

export interface BasketItem {
  productId: Types.ObjectId;
  /** Always 1 for a one-time product; periods for a subscription. */
  quantity: number;
  /** Subscription only: the variant to buy; missing means the base. */
  variantId: string;
  /** Subscription only: whether a change of variant applies by itself. */
  applyVariant: VariantApplyMode;
  /** Subscription only: when its time starts. */
  placement: CheckoutPlacement;
}

/** What a signed-in user means to buy. One per user. */
export interface BasketInterface {
  userId: Types.ObjectId;
  items: BasketItem[];
  createdAt?: Date;
  updatedAt?: Date;
}
