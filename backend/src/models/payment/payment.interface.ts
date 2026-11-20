import { Types } from "mongoose";
import type { ProductKind } from "../product/product.interface";
import type { VariantApplyMode } from "../userProductPeriod/userProductPeriod.interface";

/**
 * - pending: waiting for the user to pay (until `expiresAt`).
 * - paid: the money is in; what was bought is granted.
 * - failed / expired / cancelled: nothing was charged, nothing granted.
 * - refunded: was paid, then refunded or charged back; handled by hand.
 */
export const PAYMENT_STATUSES = [
  "pending",
  "paid",
  "failed",
  "expired",
  "cancelled",
  "refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** A store product, or "custom": a line an admin wrote, granting nothing. */
export const PAYMENT_ITEM_KINDS = [
  "subscription",
  "oneTime",
  "custom",
] as const;
export type PaymentItemKind = ProductKind | "custom";

/**
 * When a subscription line's time starts:
 * - "after": after everything the user already has of the product;
 * - "now": a switch of variant that starts at once, the time left turned
 *   into days of the new variant by what it was worth.
 */
export const CHECKOUT_PLACEMENTS = ["after", "now"] as const;
export type CheckoutPlacement = (typeof CHECKOUT_PLACEMENTS)[number];

/** Who made the invoice: the user at checkout, or an admin for them. */
export const PAYMENT_SOURCES = ["checkout", "admin"] as const;
export type PaymentSource = (typeof PAYMENT_SOURCES)[number];

/** One line on an invoice, priced as it was when the invoice was made. */
export interface PaymentItem {
  /** Null for a custom line. */
  productId: Types.ObjectId | null;
  name: string;
  /** Extra detail shown under the name; custom lines mostly. */
  description: string | null;
  kind: PaymentItemKind;
  unitPriceIdr: number;
  /** Always 1 for a one-time product; periods to add for a subscription. */
  quantity: number;
  /** Subscription only: days one period adds. */
  durationDays: number | null;
  /**
   * Subscription only: the variant bought, priced as it was. Null for other
   * lines, and on subscription lines made before variants: the base.
   */
  variantId: string | null;
  /** Subscription only: how the periods it grants apply their variant. */
  applyVariant: VariantApplyMode | null;
  /** Subscription only: when its time starts; null (older lines) is after. */
  placement: CheckoutPlacement | null;
  amountIdr: number;
  /** What was granted once paid. */
  periodIds: Types.ObjectId[];
  purchaseId: Types.ObjectId | null;
}

/**
 * One checkout by one user, and its invoice: one or more products paid for
 * together, whatever provider handled it.
 */
export interface PaymentInterface {
  userId: Types.ObjectId;
  /** e.g. "INV-2026-000042". Unique. */
  invoiceNumber: string;
  items: PaymentItem[];
  /** Total of the items, in whole rupiah. */
  amountIdr: number;
  status: PaymentStatus;
  source: PaymentSource;
  /** Which provider handled it, e.g. "midtrans", "allow-all", "free". */
  provider: string;
  /** The provider's transaction id, once it has one. */
  reference: string | null;
  /** Where the user pays, while pending. */
  redirectUrl: string | null;
  /** Snap token, to show the payment form inside our page. */
  snapToken: string | null;
  /** How the user paid, e.g. "bank_transfer", "qris". */
  paymentType: string | null;
  /** The provider's last raw status, e.g. "settlement". */
  providerStatus: string | null;
  failureReason: string | null;
  expiresAt: Date;
  paidAt: Date | null;
  /** When the products were granted. Null until then. */
  grantedAt: Date | null;
  /** Held while granting so two confirmations do not grant twice. */
  grantClaimedAt: Date | null;
  /** Last time the provider was asked for the status. */
  checkedAt: Date | null;
  /** Something did not add up (amount, already owned): an admin should look. */
  needsReview: boolean;
  reviewNote: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}
