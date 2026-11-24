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

/** What a scheduled plan change moves from and to. */
export interface PendingPlanChange {
  /** To put the plan back if the customer cancels the change. */
  fromPriceId: string;
  fromVariantId: string | null;
  fromName: string;
  /** The plan it becomes, as the customer sees it. */
  toName: string;
  /** When it starts: the next renewal. */
  effectiveAt: Date | null;
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
  /** Paddle's customer id, "ctm_...". */
  customerId: string;
  status: PaddleSubscriptionStatus;
  items: PaddleSubscriptionItem[];
  /** The checkout payment that started it. */
  firstPaymentId: Types.ObjectId | null;
  /** When Paddle charges next; null once it will not renew. */
  nextBilledAt: Date | null;
  /** Set when the customer cancelled: it ends at this time. */
  cancelsAt: Date | null;
  /**
   * A move to a cheaper variant that starts at the next renewal. Paddle
   * already bills the new price from then; the customer keeps what they
   * paid for until it starts. Null when none is waiting.
   */
  pendingChange: PendingPlanChange | null;
  createdAt?: Date;
  updatedAt?: Date;
}
