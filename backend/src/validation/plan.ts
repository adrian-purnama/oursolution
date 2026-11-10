import type { CreatePlanDto, UpdatePlanDto } from "../dto/plan.dto";
import type { AssignPlanDto, PlanEndSpec } from "../dto/userPlan.dto";
import { Types } from "mongoose";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const MAX_NAME_LENGTH = 60;
const MAX_PRICING_TEXT_LENGTH = 120;
const MAX_PRICE_IDR = 1_000_000_000_000;
const MAX_DURATION_DAYS = 36_500;

function asRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Invalid request body");
  }
  return body as Record<string, unknown>;
}

function parseName(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("name is required");
  }
  const name = value.trim();
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`name must be at most ${MAX_NAME_LENGTH} characters`);
  }
  return name;
}

function parseColor(value: unknown): string {
  if (typeof value !== "string" || !HEX_COLOR.test(value)) {
    throw new Error("color must be a hex color such as #1a5c4a");
  }
  return value.toLowerCase();
}

function parsePricingText(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("pricingText must be text");
  }
  const text = value.trim();
  if (text.length > MAX_PRICING_TEXT_LENGTH) {
    throw new Error(
      `pricingText must be at most ${MAX_PRICING_TEXT_LENGTH} characters`,
    );
  }
  return text;
}

function parsePriceIdr(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > MAX_PRICE_IDR
  ) {
    throw new Error("priceIdr must be a whole number of rupiah, 0 or more");
  }
  return value;
}

function parseBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${field} must be true or false`);
  }
  return value;
}

export function parseCreatePlanDto(body: unknown): CreatePlanDto {
  const raw = asRecord(body);
  return {
    name: parseName(raw.name),
    color: parseColor(raw.color),
    pricingText: parsePricingText(raw.pricingText ?? ""),
    priceIdr: parsePriceIdr(raw.priceIdr),
    showOnPricingPage: parseBoolean(
      raw.showOnPricingPage ?? false,
      "showOnPricingPage",
    ),
    isDefault: parseBoolean(raw.isDefault ?? false, "isDefault"),
  };
}

export function parseUpdatePlanDto(body: unknown): UpdatePlanDto {
  const raw = asRecord(body);
  const patch: UpdatePlanDto = {};

  if ("name" in raw) patch.name = parseName(raw.name);
  if ("color" in raw) patch.color = parseColor(raw.color);
  if ("pricingText" in raw) {
    patch.pricingText = parsePricingText(raw.pricingText);
  }
  if ("priceIdr" in raw) patch.priceIdr = parsePriceIdr(raw.priceIdr);
  if ("showOnPricingPage" in raw) {
    patch.showOnPricingPage = parseBoolean(
      raw.showOnPricingPage,
      "showOnPricingPage",
    );
  }
  if ("isDefault" in raw) {
    patch.isDefault = parseBoolean(raw.isDefault, "isDefault");
  }

  if (Object.keys(patch).length === 0) {
    throw new Error("No valid fields to update");
  }
  return patch;
}

/**
 * Body: `{ planId, durationDays? | endsAt? | untilCurrentEnd? }`. With none of
 * the three, the period has no end.
 */
export function parseAssignPlanDto(body: unknown): AssignPlanDto {
  const raw = asRecord(body);

  if (typeof raw.planId !== "string" || !Types.ObjectId.isValid(raw.planId)) {
    throw new Error("planId is required");
  }

  const given = ["durationDays", "endsAt", "untilCurrentEnd"].filter(
    (key) => raw[key] !== undefined && raw[key] !== null && raw[key] !== false,
  );
  if (given.length > 1) {
    throw new Error("Give only one of durationDays, endsAt or untilCurrentEnd");
  }

  let end: PlanEndSpec = { kind: "none" };

  if (given[0] === "durationDays") {
    const days = raw.durationDays;
    if (
      typeof days !== "number" ||
      !Number.isInteger(days) ||
      days < 1 ||
      days > MAX_DURATION_DAYS
    ) {
      throw new Error("durationDays must be a whole number of days, 1 or more");
    }
    end = { kind: "days", days };
  } else if (given[0] === "endsAt") {
    const at = typeof raw.endsAt === "string" ? new Date(raw.endsAt) : null;
    if (!at || Number.isNaN(at.getTime())) {
      throw new Error("endsAt must be a date");
    }
    end = { kind: "date", at };
  } else if (given[0] === "untilCurrentEnd") {
    if (raw.untilCurrentEnd !== true) {
      throw new Error("untilCurrentEnd must be true when given");
    }
    end = { kind: "currentEnd" };
  }

  return { planId: raw.planId, end };
}
