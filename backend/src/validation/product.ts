import { Types } from "mongoose";
import type { CheckoutInDto } from "../dto/payment.dto";
import type { GrantPurchaseInDto } from "../dto/purchase.dto";
import {
  PRODUCT_KINDS,
  type ProductKind,
} from "../models/product/product.interface";
import type { CreateProductDto, UpdateProductDto } from "../dto/product.dto";
import type { AssignProductDto, PeriodEndSpec } from "../dto/userProduct.dto";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const MAX_NAME_LENGTH = 60;
const MAX_PRICING_TEXT_LENGTH = 120;
const MAX_PRICE_IDR = 1_000_000_000_000;
const MAX_DURATION_DAYS = 36_500;
const MAX_URL_LENGTH = 2000;

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

function parseDays(value: unknown, field: string): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_DURATION_DAYS
  ) {
    throw new Error(`${field} must be a whole number of days, 1 or more`);
  }
  return value;
}

function parseKind(value: unknown): ProductKind {
  if (!PRODUCT_KINDS.includes(value as ProductKind)) {
    throw new Error(`kind must be one of ${PRODUCT_KINDS.join(", ")}`);
  }
  return value as ProductKind;
}

/** An http(s) link, or null to clear it. */
function parseAccessUrl(value: unknown): string | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.length > MAX_URL_LENGTH) {
    throw new Error("accessUrl must be a link");
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("accessUrl must be a full link, such as https://�");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("accessUrl must start with http:// or https://");
  }
  return url.toString();
}

function parseBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${field} must be true or false`);
  }
  return value;
}

function parseObjectId(value: unknown, field: string): string {
  if (typeof value !== "string" || !Types.ObjectId.isValid(value)) {
    throw new Error(`${field} is required`);
  }
  return value;
}

/**
 * A subscription needs a duration and has no access link; a one-time product
 * is the other way round. Fields that do not apply are stored as null.
 */
export function parseCreateProductDto(body: unknown): CreateProductDto {
  const raw = asRecord(body);
  const kind = parseKind(raw.kind ?? "subscription");
  return {
    name: parseName(raw.name),
    kind,
    color: parseColor(raw.color),
    pricingText: parsePricingText(raw.pricingText ?? ""),
    priceIdr: parsePriceIdr(raw.priceIdr),
    durationDays:
      kind === "subscription"
        ? parseDays(raw.durationDays ?? 30, "durationDays")
        : null,
    accessUrl:
      kind === "oneTime" ? parseAccessUrl(raw.accessUrl ?? null) : null,
    showOnPricingPage: parseBoolean(
      raw.showOnPricingPage ?? false,
      "showOnPricingPage",
    ),
  };
}

/** Which fields apply depends on the product's kind, which cannot change. */
export function parseUpdateProductDto(
  body: unknown,
  kind: ProductKind,
): UpdateProductDto {
  const raw = asRecord(body);
  const patch: UpdateProductDto = {};

  if ("kind" in raw && raw.kind !== kind) {
    throw new Error("A product's kind cannot be changed");
  }

  if ("name" in raw) patch.name = parseName(raw.name);
  if ("color" in raw) patch.color = parseColor(raw.color);
  if ("pricingText" in raw) {
    patch.pricingText = parsePricingText(raw.pricingText);
  }
  if ("priceIdr" in raw) patch.priceIdr = parsePriceIdr(raw.priceIdr);
  if ("durationDays" in raw && kind === "subscription") {
    patch.durationDays = parseDays(raw.durationDays, "durationDays");
  }
  if ("accessUrl" in raw && kind === "oneTime") {
    patch.accessUrl = parseAccessUrl(raw.accessUrl);
  }
  if ("showOnPricingPage" in raw) {
    patch.showOnPricingPage = parseBoolean(
      raw.showOnPricingPage,
      "showOnPricingPage",
    );
  }

  if (Object.keys(patch).length === 0) {
    throw new Error("No valid fields to update");
  }
  return patch;
}

/**
 * Body: `{ productId, durationDays? | endsAt? | untilCurrentEnd? }`. With none
 * of the three, the period has no end.
 */
export function parseAssignProductDto(body: unknown): AssignProductDto {
  const raw = asRecord(body);
  const productId = parseObjectId(raw.productId, "productId");

  const given = ["durationDays", "endsAt", "untilCurrentEnd"].filter(
    (key) => raw[key] !== undefined && raw[key] !== null && raw[key] !== false,
  );
  if (given.length > 1) {
    throw new Error("Give only one of durationDays, endsAt or untilCurrentEnd");
  }

  let end: PeriodEndSpec = { kind: "none" };

  if (given[0] === "durationDays") {
    end = { kind: "days", days: parseDays(raw.durationDays, "durationDays") };
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

  return { productId, end };
}

/** Body: `{ productId }`. */
export function parseCheckoutInDto(body: unknown): CheckoutInDto {
  const raw = asRecord(body);
  return { productId: parseObjectId(raw.productId, "productId") };
}

/** Body: `{ productId }`. */
export function parseGrantPurchaseInDto(body: unknown): GrantPurchaseInDto {
  const raw = asRecord(body);
  return { productId: parseObjectId(raw.productId, "productId") };
}
