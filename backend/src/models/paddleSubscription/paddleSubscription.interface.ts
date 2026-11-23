import { Types } from "mongoose";
import type { VariantApplyMode } from "../userProductPeriod/userProductPeriod.interface";

/**
 * Paddle's subscription statuses. "active" and "trialing" renew; "past_due"
 * is retrying a failed renewal; "paused" and "canceled" do not renew.
 */
export const PADDLE_SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "paused",
  "canceled",
] as const;
export type PaddleSubscriptionStatus =
  (typeof PADDLE_SUBSCRIPTION_STATUSES)[number];

/** One product the subscription renews, as it was bought. */
export interface PaddleSubscriptionItem {
  productId: Types.ObjectId;
  variantId: string | null;
  applyVariant: VariantApplyMode;
  /** The Paddle price billed for it. */
  priceId: string;
  /** Invoice line name, e.g. "Umami (Starter)". */
  name: string;
  durationDays: number;
}

/**
 * A subscription Paddle renews by itself for a customer outside Indonesia.
 * Each renewal Paddle charges becomes a Payment (source "renewal") that
 * grants one more period of each item.
 */
export interface PaddleSubscriptionInterface {
  userId: Types.ObjectId;
  /** Paddle's id, "sub_...". Unique. */
  subscriptionId: string;
  /** Paddle's customer id, "ctm_...", for the customer portal. */
  customerId: string;
  status: PaddleSubscriptionStatus;
  items: PaddleSubscriptionItem[];
  /** The checkout payment that started it. */
  firstPaymentId: Types.ObjectId | null;
  /** When Paddle charges next; null once it will not renew. */
  nextBilledAt: Date | null;
  /** Set when the customer cancelled: it ends at this time. */
  cancelsAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
