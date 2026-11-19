import { Types } from "mongoose";
import type { CreateRedeemCodesInDto } from "../dto/redeemCode.dto";
import {
  REDEEM_ACTIVATIONS,
  type RedeemActivation,
} from "../models/redeemCode/redeemCode.interface";

export const MAX_REDEEM_CODES_PER_BATCH = 50;
const MAX_DAYS = 3650;
const CODE_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function asRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Invalid request body");
  }
  return body as Record<string, unknown>;
}

function parseOptionalDate(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === "") return null;
  const at = typeof value === "string" ? new Date(value) : null;
  if (!at || Number.isNaN(at.getTime())) {
    throw new Error(`${field} must be a date`);
  }
  return at;
}

/**
 * Body: `{ productId, activation, activatesAt?, durationDays?, endsAt?,
 * validUntil?, quantity? }`. Whether the end fits the product's kind is
 * checked by the service, which knows the product.
 */
export function parseCreateRedeemCodesDto(
  body: unknown,
  now: Date = new Date(),
): CreateRedeemCodesInDto {
  const raw = asRecord(body);

  if (
    typeof raw.productId !== "string" ||
    !Types.ObjectId.isValid(raw.productId)
  ) {
    throw new Error("productId is required");
  }

  const activation = raw.activation ?? "onRedeem";
  if (!REDEEM_ACTIVATIONS.includes(activation as RedeemActivation)) {
    throw new Error(
      `activation must be one of ${REDEEM_ACTIVATIONS.join(", ")}`,
    );
  }
  const activatesAt =
    activation === "date"
      ? parseOptionalDate(raw.activatesAt, "activatesAt")
      : null;
  if (activation === "date" && !activatesAt) {
    throw new Error("Choose when the product becomes active");
  }

  let durationDays: number | null = null;
  if (raw.durationDays !== undefined && raw.durationDays !== null) {
    const days = raw.durationDays;
    if (
      typeof days !== "number" ||
      !Number.isInteger(days) ||
      days < 1 ||
      days > MAX_DAYS
    ) {
      throw new Error("durationDays must be a whole number of days, 1 or more");
    }
    durationDays = days;
  }
  const endsAt = parseOptionalDate(raw.endsAt, "endsAt");
  if (durationDays !== null && endsAt) {
    throw new Error("Give only one of durationDays or endsAt");
  }
  if (endsAt && activatesAt && endsAt <= activatesAt) {
    throw new Error("The end date must be after the start date");
  }
  if (endsAt && endsAt <= now) {
    throw new Error("The end date must be in the future");
  }

  const validUntil = parseOptionalDate(raw.validUntil, "validUntil");
  if (validUntil && validUntil <= now) {
    throw new Error("Valid until must be in the future");
  }

  const quantity = raw.quantity ?? 1;
  if (
    typeof quantity !== "number" ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_REDEEM_CODES_PER_BATCH
  ) {
    throw new Error(
      `quantity must be between 1 and ${MAX_REDEEM_CODES_PER_BATCH}`,
    );
  }

  return {
    productId: raw.productId,
    activation: activation as RedeemActivation,
    activatesAt,
    durationDays,
    endsAt,
    validUntil,
    quantity,
  };
}

/**
 * Body: `{ code }`. Case, spaces and dashes do not matter; the result is
 * XXXX-XXXX-XXXX.
 */
export function parseRedeemCode(body: unknown): string {
  const raw = asRecord(body);
  if (typeof raw.code !== "string") throw new Error("Enter a code");
  const plain = raw.code.toUpperCase().replace(/[\s-]/g, "");
  const code = `${plain.slice(0, 4)}-${plain.slice(4, 8)}-${plain.slice(8)}`;
  if (!CODE_PATTERN.test(code)) {
    throw new Error("That code is not valid");
  }
  return code;
}
