import { Types } from "mongoose";

export const PRODUCT_PERIOD_SOURCES = ["admin", "checkout", "redeem"] as const;
export type ProductPeriodSource = (typeof PRODUCT_PERIOD_SOURCES)[number];

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
  source: ProductPeriodSource;
  /** The admin who created it, when source is "admin". */
  createdBy?: Types.ObjectId;
  /** The payment that bought it, when source is "checkout". */
  paymentId?: Types.ObjectId;
  /** The code that was redeemed for it, when source is "redeem". */
  redeemCodeId?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}
