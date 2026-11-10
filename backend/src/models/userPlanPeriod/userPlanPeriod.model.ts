import { model, Schema } from "mongoose";
import {
  PLAN_PERIOD_SOURCES,
  UserPlanPeriodInterface,
} from "./userPlanPeriod.interface";

const userPlanPeriodSchema = new Schema<UserPlanPeriodInterface>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: "Plan",
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
      enum: PLAN_PERIOD_SOURCES,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  { timestamps: true },
);

userPlanPeriodSchema.index({ userId: 1, startsAt: 1 });
userPlanPeriodSchema.index({ planId: 1 });

export const UserPlanPeriodModel = model<UserPlanPeriodInterface>(
  "UserPlanPeriod",
  userPlanPeriodSchema,
);
