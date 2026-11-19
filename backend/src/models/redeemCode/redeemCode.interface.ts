import { Types } from "mongoose";

export const REDEEM_ACTIVATIONS = ["onRedeem", "date"] as const;
export type RedeemActivation = (typeof REDEEM_ACTIVATIONS)[number];

/**
 * A code that gives its redeemer one product, once. A one-time product is
 * owned for good; a subscription gets one period, which starts when the code
 * is redeemed (after anything already scheduled) or on a set date, and ends
 * after `durationDays` or on `endsAt`.
 */
export interface RedeemCodeInterface {
  /** Stored as XXXX-XXXX-XXXX, upper case. */
  code: string;
  productId: Types.ObjectId;
  activation: RedeemActivation;
  /** When activation is "date". */
  activatesAt: Date | null;
  /** Subscriptions: how long the period lasts from its start. */
  durationDays: number | null;
  /** Subscriptions: a fixed end instead of a duration. */
  endsAt: Date | null;
  /** Last moment the code can be redeemed; null means it never expires. */
  validUntil: Date | null;
  createdBy: Types.ObjectId;
  redeemedBy: Types.ObjectId | null;
  redeemedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
