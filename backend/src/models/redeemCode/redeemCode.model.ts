import { model, Schema } from "mongoose";
import {
  REDEEM_ACTIVATIONS,
  RedeemCodeInterface,
} from "./redeemCode.interface";

const redeemCodeSchema = new Schema<RedeemCodeInterface>(
  {
    code: { type: String, required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: String, default: null },
    activation: { type: String, required: true, enum: REDEEM_ACTIVATIONS },
    activatesAt: { type: Date, default: null },
    durationDays: { type: Number, default: null },
    endsAt: { type: Date, default: null },
    validUntil: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    redeemedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    redeemedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

redeemCodeSchema.index({ code: 1 }, { unique: true });
redeemCodeSchema.index({ redeemedAt: 1, validUntil: 1, createdAt: -1 });

export const RedeemCodeModel = model<RedeemCodeInterface>(
  "RedeemCode",
  redeemCodeSchema,
);
