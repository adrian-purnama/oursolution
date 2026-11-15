import { model, Schema } from "mongoose";
import type { BasketInterface, BasketItem } from "./basket.interface";

const basketItemSchema = new Schema<BasketItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
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
