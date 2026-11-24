import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "../../environment/env";
import { logger } from "../../logger/logger";
import type { OtpPurpose } from "../../models/otp/otp.interface";
import { OtpModel } from "../../models/otp/otp.model";
import { UserError } from "../../utils/userError";

const logSource = "modules/otp/otp.service.ts";

/** Wrong guesses allowed per issued code before it is discarded. */
export const MAX_OTP_ATTEMPTS = 5;
/** Minimum gap between two codes for the same email and purpose. */
export const OTP_RESEND_COOLDOWN_MS = 60_000;

export class OtpCooldownError extends UserError {
  constructor() {
    super("Please wait a minute before requesting another code");
  }
}

function hashOtp(email: string, purpose: OtpPurpose, otp: string): string {
  return createHmac("sha256", env.jwtSecret)
    .update(`${purpose}:${email}:${otp}`)
    .digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export class OtpService {
  generateOtp(): string {
    return randomInt(100_000, 1_000_000).toString();
  }

  /** True when a code for this email and purpose was issued too recently. */
  async isCoolingDown(
    email: string,
    purpose: OtpPurpose,
    now: number = Date.now(),
  ): Promise<boolean> {
    const recent = await OtpModel.findOne({
      email,
      purpose,
      createdAt: { $gt: new Date(now - OTP_RESEND_COOLDOWN_MS) },
    }).exec();
    return Boolean(recent);
  }

  /** Replaces any previous code for this email and purpose; returns the new code. */
  async issue(email: string, purpose: OtpPurpose): Promise<string> {
    if (await this.isCoolingDown(email, purpose)) {
      throw new OtpCooldownError();
    }

    const otp = this.generateOtp();
    await OtpModel.deleteMany({ email, purpose });
    await OtpModel.create({
      email,
      purpose,
      otpHash: hashOtp(email, purpose, otp),
    });
    return otp;
  }

  async validateAndConsume(
    email: string,
    otp: string,
    purpose: OtpPurpose,
  ): Promise<boolean> {
    // Take an attempt slot atomically so parallel guesses cannot exceed the cap.
    const doc = await OtpModel.findOneAndUpdate(
      { email, purpose, attempts: { $lt: MAX_OTP_ATTEMPTS } },
      { $inc: { attempts: 1 } },
      { returnDocument: "after" },
    ).exec();

    if (!doc) {
      await OtpModel.deleteMany({ email, purpose });
      logger.warn(
        `No usable OTP for ${email} (${purpose})`,
        logSource,
        "validateAndConsume",
      );
      return false;
    }

    if (!safeEqual(doc.otpHash, hashOtp(email, purpose, otp))) {
      logger.warn(
        `Wrong OTP for ${email} (${purpose}), attempt ${doc.attempts}/${MAX_OTP_ATTEMPTS}`,
        logSource,
        "validateAndConsume",
      );
      return false;
    }

    // Only the request that actually deletes the code may use it.
    const consumed = await OtpModel.findOneAndDelete({ _id: doc._id }).exec();
    return Boolean(consumed);
  }
}
