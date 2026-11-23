import { model, Schema } from "mongoose";
import { VARIANT_APPLY_MODES } from "../userProductPeriod/userProductPeriod.interface";
import {
  PADDLE_SUBSCRIPTION_STATUSES,
  type PaddleSubscriptionInterface,
  type PaddleSubscriptionItem,
} from "./paddleSubscription.interface";

const itemSchema = new Schema<PaddleSubscriptionItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: String, default: null },
    applyVariant: { type: String, enum: VARIANT_APPLY_MODES, default: "auto" },
    priceId: { type: String, required: true },
    name: { type: String, required: true },
    durationDays: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const paddleSubscriptionSchema = new Schema<PaddleSubscriptionInterface>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subscriptionId: { type: String, required: true, unique: true },
    customerId: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: PADDLE_SUBSCRIPTION_STATUSES,
    },
    items: { type: [itemSchema], default: [] },
    firstPaymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
    nextBilledAt: { type: Date, default: null },
    cancelsAt: { type: Date, default: null },
  },
  { timestamps: true },
);

paddleSubscriptionSchema.index({ userId: 1, status: 1 });
paddleSubscriptionSchema.index({ "items.productId": 1 });

export const PaddleSubscriptionModel = model<PaddleSubscriptionInterface>(
  "PaddleSubscription",
  paddleSubscriptionSchema,
);
