import { model, Schema } from "mongoose";
import { BASE_VARIANT_ID } from "../product/product.interface";
import {
  PRODUCT_PERIOD_SOURCES,
  UserProductPeriodInterface,
  VARIANT_APPLY_MODES,
} from "./userProductPeriod.interface";

const userProductPeriodSchema = new Schema<UserProductPeriodInterface>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    startsAt: {
      type: Date,
      required: true,
    },
    endsAt: {
      type: Date,
      default: null,
    },
    variantId: {
      type: String,
      default: BASE_VARIANT_ID,
    },
    applyVariant: {
      type: String,
      enum: VARIANT_APPLY_MODES,
      default: "auto",
    },
    source: {
      type: String,
      required: true,
      enum: PRODUCT_PERIOD_SOURCES,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      required: false,
    },
    redeemCodeId: {
      type: Schema.Types.ObjectId,
      ref: "RedeemCode",
      required: false,
    },
    reminderSentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

userProductPeriodSchema.index({ userId: 1, productId: 1, startsAt: 1 });
userProductPeriodSchema.index({ productId: 1 });
// The expiry reminder sweep: periods about to end, not yet reminded.
userProductPeriodSchema.index({ endsAt: 1, reminderSentAt: 1 });

export const UserProductPeriodModel = model<UserProductPeriodInterface>(
  "UserProductPeriod",
  userProductPeriodSchema,
);
