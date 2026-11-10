import { model, Schema } from "mongoose";
import { OtpInterface } from "./otp.interface";

export const OTP_TTL_SECONDS = 300;

const otpSchema = new Schema<OtpInterface>({
  otpHash: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  purpose: {
    type: String,
    required: true,
    enum: ["register", "reset"],
  },
  attempts: {
    type: Number,
    required: true,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: OTP_TTL_SECONDS,
  },
});

otpSchema.index({ email: 1, purpose: 1 });

export const OtpModel = model<OtpInterface>("Otp", otpSchema);
