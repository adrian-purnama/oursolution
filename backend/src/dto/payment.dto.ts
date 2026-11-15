import type {
  PaymentItemKind,
  PaymentSource,
  PaymentStatus,
} from "../models/payment/payment.interface";
import type { ProductKind } from "../models/product/product.interface";
import type { ProductSummaryDto } from "./product.dto";

/** One product the user means to buy. */
export interface CheckoutItemInDto {
  productId: string;
  quantity: number;
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
  /** Why this line cannot be bought now, or null. */
  problem: string | null;
}

/** The basket, or what a checkout would charge. */
export interface CheckoutQuoteOutDto {
  lines: CheckoutLineOutDto[];
  /** Total of the lines without a problem. */
  totalIdr: number;
  /** True when there are lines and none has a problem. */
  canCheckout: boolean;
}

export interface CheckoutOutDto {
  paymentId: string;
  invoiceNumber: string;
  status: PaymentStatus;
  /** Where to send the user to pay, for providers that need it. */
  redirectUrl: string | null;
  /** Snap token, to pay inside the page. */
  snapToken: string | null;
}

/** One line of an invoice an admin makes for a user. */
export type AdminInvoiceLineInDto =
  | {
      type: "product";
      productId: string;
      quantity: number;
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
  amountIdr: number;
}

/** A payment and its invoice. */
export interface PaymentOutDto {
  id: string;
  invoiceNumber: string;
  status: PaymentStatus;
  source: PaymentSource;
  amountIdr: number;
  items: PaymentItemOutDto[];
  provider: string;
  paymentType: string | null;
  /** Where to pay; only while pending and not past its expiry. */
  redirectUrl: string | null;
  /** Snap token for the inline payment form; same rule as redirectUrl. */
  snapToken: string | null;
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

/** What the browser needs to show the payment form inline. */
export interface PaymentConfigOutDto {
  provider: string | null;
  /** Midtrans Snap: script URL and public client key, or null. */
  snap: { scriptUrl: string; clientKey: string } | null;
}
