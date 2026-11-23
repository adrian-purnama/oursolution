import { model, Schema } from "mongoose";
import { BILLING_REGIONS, USER_ROLES, UserInterface } from "./user.interface";

const userSchema = new Schema<UserInterface>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    hashedPassword: {
      type: String,
      default: undefined,
    },
    googleId: {
      type: String,
      default: undefined,
      unique: true,
      sparse: true,
    },
    isBlocked: {
      type: Boolean,
      required: true,
      default: false,
    },
    role: {
      type: String,
      required: true,
      enum: USER_ROLES,
      default: "user",
    },
    tokenVersion: {
      type: Number,
      required: true,
      default: 0,
    },
    deployUsername: {
      type: String,
      default: undefined,
      unique: true,
      sparse: true,
    },
    billingRegion: {
      type: String,
      enum: [...BILLING_REGIONS, null],
      default: null,
    },
    billingRegionLocked: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

export const UserModel = model<UserInterface>("User", userSchema);
