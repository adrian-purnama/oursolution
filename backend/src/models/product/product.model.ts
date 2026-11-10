import { model, Schema } from "mongoose";
import { PRODUCT_KINDS, ProductInterface } from "./product.interface";

const productSchema = new Schema<ProductInterface>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    kind: {
      type: String,
      required: true,
      enum: PRODUCT_KINDS,
      // Products made before kinds existed were all subscriptions.
      default: "subscription",
    },
    color: {
      type: String,
      required: true,
    },
    pricingText: {
      type: String,
      required: false,
      default: "",
    },
    priceIdr: {
      type: Number,
      required: true,
      min: 0,
    },
    durationDays: {
      type: Number,
      default: null,
      min: 1,
    },
    accessUrl: {
      type: String,
      default: null,
    },
    showOnPricingPage: {
      type: Boolean,
      required: true,
      default: false,
    },
    image: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

export const ProductModel = model<ProductInterface>("Product", productSchema);
