export type OtpPurpose = "register" | "reset";

export interface OtpInterface {
  /** HMAC of the code; the plain code is never stored. */
  otpHash: string;
  email: string;
  purpose: OtpPurpose;
  attempts: number;
  createdAt?: Date;
}
