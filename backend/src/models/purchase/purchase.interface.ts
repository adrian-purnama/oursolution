import { Types } from "mongoose";

export const PURCHASE_SOURCES = ["admin", "checkout", "redeem"] as const;
export type PurchaseSource = (typeof PURCHASE_SOURCES)[number];

/**
 * A one-time product a user owns. It never expires; a user owns each product
 * at most once.
 */
export interface PurchaseInterface {
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  source: PurchaseSource;
  /** The admin who granted it, when source is "admin". */
  grantedBy?: Types.ObjectId;
  /** The payment that bought it, when source is "checkout". */
  paymentId?: Types.ObjectId;
  /** The code that was redeemed for it, when source is "redeem". */
  redeemCodeId?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}
