import { Types } from "mongoose";

export const PAYMENT_STATUSES = ["pending", "paid", "failed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** One checkout of one product by one user, whatever provider handled it. */
export interface PaymentInterface {
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  /** Price at the time of checkout, in whole rupiah. */
  amountIdr: number;
  /** Days of access this payment buys; null for a one-time product. */
  durationDays: number | null;
  status: PaymentStatus;
  /** Which provider handled it, e.g. "allow-all". */
  provider: string;
  /** The provider's id for this payment, once it has one. */
  reference: string | null;
  failureReason: string | null;
  /** What was granted once paid: a period (subscription) or a purchase (one-time). */
  periodId: Types.ObjectId | null;
  purchaseId: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}
