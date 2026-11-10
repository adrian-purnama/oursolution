import { model, Schema } from "mongoose";
import { PAYMENT_STATUSES, PaymentInterface } from "./payment.interface";

const paymentSchema = new Schema<PaymentInterface>(
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
    amountIdr: {
      type: Number,
      required: true,
      min: 0,
    },
    durationDays: {
      type: Number,
      default: null,
      min: 1,
    },
    status: {
      type: String,
      required: true,
      enum: PAYMENT_STATUSES,
      default: "pending",
    },
    provider: {
      type: String,
      required: true,
    },
    reference: {
      type: String,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
    periodId: {
      type: Schema.Types.ObjectId,
      ref: "UserProductPeriod",
      default: null,
    },
    purchaseId: {
      type: Schema.Types.ObjectId,
      ref: "Purchase",
      default: null,
    },
  },
  { timestamps: true },
);

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ productId: 1 });

export const PaymentModel = model<PaymentInterface>("Payment", paymentSchema);
