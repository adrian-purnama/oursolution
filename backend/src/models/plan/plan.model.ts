import { model, Schema } from "mongoose";
import { PlanInterface } from "./plan.interface";

const planSchema = new Schema<PlanInterface>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
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
    showOnPricingPage: {
      type: Boolean,
      required: true,
      default: false,
    },
    isDefault: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  { timestamps: true },
);

// The database itself refuses a second default plan.
planSchema.index(
  { isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } },
);

export const PlanModel = model<PlanInterface>("Plan", planSchema);
