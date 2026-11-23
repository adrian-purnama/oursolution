import { Types } from "mongoose";

export const PRODUCT_PERIOD_SOURCES = ["admin", "checkout", "redeem"] as const;
export type ProductPeriodSource = (typeof PRODUCT_PERIOD_SOURCES)[number];

/**
 * What happens when a period's variant differs from what is deployed:
 * - "auto": the service is redeployed on it by itself;
 * - "manual": the customer applies it (or it applies the next time the
 *   service is turned on).
 */
export const VARIANT_APPLY_MODES = ["auto", "manual"] as const;
export type VariantApplyMode = (typeof VARIANT_APPLY_MODES)[number];

/**
 * A stretch of time during which a user has one product active. Periods of the
 * same user and product never overlap; different products overlap freely.
 * Time not covered by a period means the product is not active.
 */
export interface UserProductPeriodInterface {
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  startsAt: Date;
  /** null means "until changed". */
  endsAt: Date | null;
  /**
   * The product variant it pays for; BASE_VARIANT_ID for the product's own.
   * Periods saved before variants existed have none: they are on the base.
   */
  variantId: string;
  /** Whether a change of variant redeploys the service by itself. */
  applyVariant: VariantApplyMode;
  source: ProductPeriodSource;
  /** The admin who created it, when source is "admin". */
  createdBy?: Types.ObjectId;
  /** The payment that bought it, when source is "checkout". */
  paymentId?: Types.ObjectId;
  /** The code that was redeemed for it, when source is "redeem". */
  redeemCodeId?: Types.ObjectId;
  /** When its owner was told it is about to end; null until then. */
  reminderSentAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
