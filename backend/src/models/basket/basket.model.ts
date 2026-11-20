import { model, Schema } from "mongoose";
import { CHECKOUT_PLACEMENTS } from "../payment/payment.interface";
import { BASE_VARIANT_ID } from "../product/product.interface";
import { VARIANT_APPLY_MODES } from "../userProductPeriod/userProductPeriod.interface";
import type { BasketInterface, BasketItem } from "./basket.interface";

const basketItemSchema = new Schema<BasketItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
    variantId: { type: String, default: BASE_VARIANT_ID },
    applyVariant: { type: String, enum: VARIANT_APPLY_MODES, default: "auto" },
    placement: { type: String, enum: CHECKOUT_PLACEMENTS, default: "after" },
  },
  { _id: false },
);

const basketSchema = new Schema<BasketInterface>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: [basketItemSchema], default: [] },
  },
  { timestamps: true },
);

basketSchema.index({ userId: 1 }, { unique: true });

export const BasketModel = model<BasketInterface>("Basket", basketSchema);
