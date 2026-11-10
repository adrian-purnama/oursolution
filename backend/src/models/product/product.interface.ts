import { Types } from "mongoose";

/**
 * - "subscription": active for a period (hosting). Lives on the user's plan
 *   timeline; each checkout adds `durationDays`.
 * - "oneTime": bought once and kept for good (e.g. an n8n workflow). Buying it
 *   creates a Purchase; it never expires.
 */
export const PRODUCT_KINDS = ["subscription", "oneTime"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

/** Something a user can have: a subscription or a one-time purchase. */
export interface ProductInterface {
  name: string;
  /** Fixed at creation: records already made depend on it. */
  kind: ProductKind;
  /** Hex color, e.g. "#1a5c4a". */
  color: string;
  /** Free text shown on the pricing page, e.g. "Rp 99.000 / month". */
  pricingText: string;
  /** Amount charged per checkout, in whole rupiah. */
  priceIdr: number;
  /** Subscription only: how long one checkout keeps it active. */
  durationDays: number | null;
  /** One-time only: where buyers get what they bought. Never shown publicly. */
  accessUrl: string | null;
  /** Listed on the public pricing page, and so open to checkout. */
  showOnPricingPage: boolean;
  /** Public image in the "public" GridFS bucket, served from /media/:id. */
  image: Types.ObjectId | null;
  /**
   * Set when soft deleted: hidden from the pricing page, checkout and admin
   * assignment, but kept so owners keep access and it can be restored.
   */
  deletedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
