import { model, Schema } from "mongoose";
import {
  PRODUCT_PERIOD_SOURCES,
  UserProductPeriodInterface,
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
  },
  { timestamps: true },
);

userProductPeriodSchema.index({ userId: 1, productId: 1, startsAt: 1 });
userProductPeriodSchema.index({ productId: 1 });

export const UserProductPeriodModel = model<UserProductPeriodInterface>(
  "UserProductPeriod",
  userProductPeriodSchema,
);
