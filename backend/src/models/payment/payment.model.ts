import { VARIANT_APPLY_MODES } from "../userProductPeriod/userProductPeriod.interface";
import { model, Schema } from "mongoose";
import {
  CHECKOUT_PLACEMENTS,
  PAYMENT_CURRENCIES,
  PAYMENT_ITEM_KINDS,
  PAYMENT_SOURCES,
  PAYMENT_STATUSES,
  type PaymentInterface,
  type PaymentItem,
} from "./payment.interface";

const paymentItemSchema = new Schema<PaymentItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", default: null },
    name: { type: String, required: true },
    description: { type: String, default: null },
    kind: { type: String, required: true, enum: PAYMENT_ITEM_KINDS },
    unitPriceIdr: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    durationDays: { type: Number, default: null, min: 1 },
    variantId: { type: String, default: null },
    applyVariant: { type: String, enum: VARIANT_APPLY_MODES, default: null },
    placement: { type: String, enum: CHECKOUT_PLACEMENTS, default: null },
    amountIdr: { type: Number, required: true, min: 0 },
    providerPriceId: { type: String, default: null },
    periodIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "UserProductPeriod" }],
      default: [],
    },
    purchaseId: { type: Schema.Types.ObjectId, ref: "Purchase", default: null },
  },
  { _id: false },
);

const paymentSchema = new Schema<PaymentInterface>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    invoiceNumber: { type: String, required: true },
    items: { type: [paymentItemSchema], required: true },
    amountIdr: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: PAYMENT_CURRENCIES, default: "IDR" },
    status: {
      type: String,
      required: true,
      enum: PAYMENT_STATUSES,
      default: "pending",
    },
    // Invoices made before admins could issue them were all checkouts.
    source: {
      type: String,
      required: true,
      enum: PAYMENT_SOURCES,
      default: "checkout",
    },
    provider: { type: String, required: true },
    reference: { type: String, default: null },
    subscriptionRef: { type: String, default: null },
    redirectUrl: { type: String, default: null },
    snapToken: { type: String, default: null },
    paymentType: { type: String, default: null },
    providerStatus: { type: String, default: null },
    failureReason: { type: String, default: null },
    expiresAt: { type: Date, required: true },
    paidAt: { type: Date, default: null },
    grantedAt: { type: Date, default: null },
    grantClaimedAt: { type: Date, default: null },
    checkedAt: { type: Date, default: null },
    needsReview: { type: Boolean, default: false },
    reviewNote: { type: String, default: null },
  },
  { timestamps: true },
);

paymentSchema.index({ invoiceNumber: 1 }, { unique: true });
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ "items.productId": 1 });
paymentSchema.index({ status: 1, checkedAt: 1 });
// Webhooks find a payment by the provider's transaction id.
paymentSchema.index({ provider: 1, reference: 1 });
// One invoice per Paddle transaction, even when a webhook arrives twice.
paymentSchema.index(
  { reference: 1 },
  {
    unique: true,
    partialFilterExpression: {
      provider: "paddle",
      reference: { $type: "string" },
    },
  },
);

export const PaymentModel = model<PaymentInterface>("Payment", paymentSchema);
