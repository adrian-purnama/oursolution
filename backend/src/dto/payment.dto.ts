import type { BillingRegion } from "../models/user/user.interface";
import type {
  CheckoutPlacement,
  PaymentCurrency,
  PaymentItemKind,
  PaymentSource,
  PaymentStatus,
} from "../models/payment/payment.interface";
import type { ProductKind } from "../models/product/product.interface";
import type { VariantApplyMode } from "../models/userProductPeriod/userProductPeriod.interface";
import type { ProductSummaryDto } from "./product.dto";

/** One product the user means to buy. */
export interface CheckoutItemInDto {
  productId: string;
  quantity: number;
  /** Subscription only: the variant; null or missing is the base one. */
  variantId?: string | null;
  /** Subscription only: apply a change of variant by itself; default auto. */
  applyVariant?: VariantApplyMode;
  /** Subscription only: when its time starts; default after. */
  placement?: CheckoutPlacement;
}

/** A change to one basket line; only the fields given change. */
export interface BasketLinePatchInDto {
  quantity?: number;
  /** Null is the base variant. */
  variantId?: string | null;
  applyVariant?: VariantApplyMode;
  placement?: CheckoutPlacement;
}

/** What switching now does, worked out when quoted (redone when paid). */
export interface CheckoutSwitchOutDto {
  /** What the time left is worth, in whole rupiah. */
  creditIdr: number;
  /** Days of the new variant that credit gives, on top of those bought. */
  bonusDays: number;
  /** When the new variant would run until. */
  endsAt: string;
}

/** A variant the line could be switched to, priced now. */
export interface CheckoutVariantOptionOutDto {
  id: string;
  name: string;
  specs: string;
  unitPriceIdr: number;
  durationDays: number | null;
}

export interface CheckoutInDto {
  items: CheckoutItemInDto[];
  /** Remove the bought products from the basket once the invoice exists. */
  fromBasket: boolean;
}

export interface CheckoutQuoteInDto {
  items: CheckoutItemInDto[];
}

/** One line of a basket or checkout, priced now. */
export interface CheckoutLineOutDto {
  product: ProductSummaryDto;
  unitPriceIdr: number;
  quantity: number;
  /** 1 for a one-time product. */
  maxQuantity: number;
  durationDays: number | null;
  amountIdr: number;
  /** Subscription only: the variant this line buys; else null. */
  variant: { id: string; name: string } | null;
  /** Subscription only: every variant it could buy, the base first. */
  variants: CheckoutVariantOptionOutDto[];
  /** Subscription only: how a change of variant applies; else null. */
  applyVariant: VariantApplyMode | null;
  /** Subscription only: when its time starts; else null. */
  placement: CheckoutPlacement | null;
  /** Switching now: what it does. Null otherwise, or when it cannot. */
  switch: CheckoutSwitchOutDto | null;
  /** Why this line cannot be bought now, or null. */
  problem: string | null;
}

/**
 * The basket, or what a checkout would charge. Every amount is in
 * `currency`: whole rupiah for IDR, cents for USD.
 */
export interface CheckoutQuoteOutDto {
  lines: CheckoutLineOutDto[];
  /** Total of the lines without a problem. */
  totalIdr: number;
  /** True when there are lines and none has a problem. */
  canCheckout: boolean;
  currency: PaymentCurrency;
  /** Where the user is billed: decides the currency and the provider. */
  region: BillingRegion;
  /** True once the user has checked out: only an admin can change it. */
  regionLocked: boolean;
}

export interface CheckoutOutDto {
  paymentId: string;
  invoiceNumber: string;
  status: PaymentStatus;
  /** "midtrans", "paddle", "free", ... */
  provider: string;
  /** Where to send the user to pay, for providers that need it. */
  redirectUrl: string | null;
  /** Snap token, to pay inside the page. */
  snapToken: string | null;
  /** Paddle: the transaction Paddle.js opens to pay inside the page. */
  paddleTransactionId: string | null;
}

/** Body of PUT /me/billing-region. */
export interface BillingRegionInDto {
  region: BillingRegion;
}

export interface BillingRegionOutDto {
  region: BillingRegion;
  locked: boolean;
  /** False when Paddle is not set up: everyone is billed in Indonesia. */
  international: boolean;
}

/** A subscription Paddle renews for the user. */
export interface PaddleSubscriptionOutDto {
  id: string;
  status: string;
  products: { productId: string; name: string }[];
  nextBilledAt: string | null;
  cancelsAt: string | null;
}

/** One line of an invoice an admin makes for a user. */
export type AdminInvoiceLineInDto =
  | {
      type: "product";
      productId: string;
      quantity: number;
      /** Subscription only: the variant; null or missing is the base one. */
      variantId?: string | null;
      /** Overrides the store price; null keeps it. */
      unitPriceIdr: number | null;
      /** Extra detail on the invoice line. */
      description: string | null;
    }
  | {
      type: "custom";
      name: string;
      description: string | null;
      unitPriceIdr: number;
      quantity: number;
    };

/** An invoice an admin makes for a user: products at any price, or custom work. */
export interface AdminInvoiceInDto {
  lines: AdminInvoiceLineInDto[];
  /** Days the user has to pay. */
  dueDays: number;
  /** Email the user that the invoice is waiting. */
  notify: boolean;
}

export interface PaymentItemOutDto {
  /** Null for a custom line. */
  productId: string | null;
  name: string;
  description: string | null;
  kind: PaymentItemKind;
  unitPriceIdr: number;
  quantity: number;
  durationDays: number | null;
  variantId: string | null;
  amountIdr: number;
}

/** A payment and its invoice. */
export interface PaymentOutDto {
  id: string;
  invoiceNumber: string;
  status: PaymentStatus;
  source: PaymentSource;
  /** Every amount on the invoice is in it: whole rupiah, or US cents. */
  currency: PaymentCurrency;
  amountIdr: number;
  items: PaymentItemOutDto[];
  provider: string;
  paymentType: string | null;
  /** Where to pay; only while pending and not past its expiry. */
  redirectUrl: string | null;
  /** Snap token for the inline payment form; same rule as redirectUrl. */
  snapToken: string | null;
  /** Paddle transaction for Paddle.js; same rule as redirectUrl. */
  paddleTransactionId: string | null;
  expiresAt: string;
  paidAt: string | null;
  grantedAt: string | null;
  needsReview: boolean;
  reviewNote: string | null;
  failureReason: string | null;
  createdAt: string;
  /** Who paid. Filled for admins. */
  user: { id: string; email: string } | null;
}

export interface PaymentListOutDto {
  items: PaymentOutDto[];
  page: number;
  pageSize: number;
  total: number;
}

/** Admin: every payment, with how many fall in each status group. */
export interface AdminPaymentListOutDto extends PaymentListOutDto {
  counts: {
    all: number;
    paid: number;
    pending: number;
    closed: number;
    refunded: number;
  };
}

/** What the browser needs to show the payment form inline. */
export interface PaymentConfigOutDto {
  provider: string | null;
  /** Midtrans Snap: script URL and public client key, or null. */
  snap: { scriptUrl: string; clientKey: string } | null;
  /** Paddle.js: public client token and environment, or null. */
  paddle: { clientToken: string; environment: "sandbox" | "production" } | null;
}

/** A variant a renewing subscription can move to. */
export interface UpgradeChoiceOutDto {
  variantId: string;
  name: string;
  /** What it renews at, in US cents. */
  priceCents: number;
}

/** What moving to a variant costs now. */
export interface UpgradePreviewOutDto {
  variantId: string;
  name: string;
  currency: string;
  /** Charged now, or credited when `credit`, in the lowest unit. */
  amountCents: number;
  credit: boolean;
  nextBilledAt: string | null;
  /** What each renewal costs from now on, in US cents (before tax). */
  renewalCents: number;
}
