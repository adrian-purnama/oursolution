import { model, Schema } from "mongoose";
import { PURCHASE_SOURCES, PurchaseInterface } from "./purchase.interface";

const purchaseSchema = new Schema<PurchaseInterface>(
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
    source: {
      type: String,
      required: true,
      enum: PURCHASE_SOURCES,
    },
    grantedBy: {
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

// The database itself refuses owning the same product twice.
purchaseSchema.index({ userId: 1, productId: 1 }, { unique: true });
purchaseSchema.index({ productId: 1 });

export const PurchaseModel = model<PurchaseInterface>(
  "Purchase",
  purchaseSchema,
);
