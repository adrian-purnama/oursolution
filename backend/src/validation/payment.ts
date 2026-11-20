import { Types } from "mongoose";
import type {
  AdminInvoiceInDto,
  AdminInvoiceLineInDto,
  BasketLinePatchInDto,
  CheckoutInDto,
  CheckoutItemInDto,
  CheckoutQuoteInDto,
} from "../dto/payment.dto";
import {
  CHECKOUT_PLACEMENTS,
  type CheckoutPlacement,
} from "../models/payment/payment.interface";
import {
  VARIANT_APPLY_MODES,
  type VariantApplyMode,
} from "../models/userProductPeriod/userProductPeriod.interface";
import { MAX_CHECKOUT_LINES } from "../modules/payment/checkout.rules";

const VARIANT_ID = /^[A-Za-z0-9_-]{1,40}$/;

/** A variant id, or null for the base variant. */
function parseVariantId(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !VARIANT_ID.test(value)) {
    throw new Error("variantId is not a valid variant");
  }
  return value;
}

function parsePlacement(value: unknown): CheckoutPlacement {
  if (value === undefined || value === null) return "after";
  if (!CHECKOUT_PLACEMENTS.includes(value as CheckoutPlacement)) {
    throw new Error(
      `placement must be one of ${CHECKOUT_PLACEMENTS.join(", ")}`,
    );
  }
  return value as CheckoutPlacement;
}

function parseApplyVariant(value: unknown): VariantApplyMode {
  if (value === undefined || value === null) return "auto";
  if (!VARIANT_APPLY_MODES.includes(value as VariantApplyMode)) {
    throw new Error(
      `applyVariant must be one of ${VARIANT_APPLY_MODES.join(", ")}`,
    );
  }
  return value as VariantApplyMode;
}

function asRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Invalid request body");
  }
  return body as Record<string, unknown>;
}

function parseProductId(value: unknown): string {
  if (typeof value !== "string" || !Types.ObjectId.isValid(value)) {
    throw new Error("productId is required");
  }
  return value;
}

/** A whole number of at least 1; the product's own limit is applied later. */
export function parseQuantity(value: unknown, fallback?: number): number {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error("quantity must be a whole number of at least 1");
  }
  return value;
}

function parseItems(value: unknown): CheckoutItemInDto[] {
  if (!Array.isArray(value)) throw new Error("items must be a list");
  if (value.length > MAX_CHECKOUT_LINES) {
    throw new Error(`At most ${MAX_CHECKOUT_LINES} products per checkout`);
  }
  return value.map((entry) => {
    const raw = asRecord(entry);
    return {
      productId: parseProductId(raw.productId),
      quantity: parseQuantity(raw.quantity, 1),
      variantId: parseVariantId(raw.variantId),
      applyVariant: parseApplyVariant(raw.applyVariant),
      placement: parsePlacement(raw.placement),
    };
  });
}

/** Body: `{ items: [{ productId, quantity, variantId?, applyVariant? }], fromBasket? }`. */
export function parseCheckoutInDto(body: unknown): CheckoutInDto {
  const raw = asRecord(body);
  return {
    items: parseItems(raw.items),
    fromBasket: raw.fromBasket === true,
  };
}

/** Body: `{ items: [{ productId, quantity }] }`. */
export function parseCheckoutQuoteInDto(body: unknown): CheckoutQuoteInDto {
  return { items: parseItems(asRecord(body).items) };
}

/** Body: `{ productId, quantity?, variantId?, applyVariant? }`. */
export function parseBasketAddInDto(body: unknown): CheckoutItemInDto {
  const raw = asRecord(body);
  return {
    productId: parseProductId(raw.productId),
    quantity: parseQuantity(raw.quantity, 1),
    variantId: parseVariantId(raw.variantId),
    applyVariant: parseApplyVariant(raw.applyVariant),
    placement: parsePlacement(raw.placement),
  };
}

/** Body: any of `{ quantity, variantId, applyVariant, placement }`. */
export function parseBasketLinePatchInDto(body: unknown): BasketLinePatchInDto {
  const raw = asRecord(body);
  const patch: BasketLinePatchInDto = {};
  if ("quantity" in raw) patch.quantity = parseQuantity(raw.quantity);
  if ("variantId" in raw) patch.variantId = parseVariantId(raw.variantId);
  if ("applyVariant" in raw) {
    patch.applyVariant = parseApplyVariant(raw.applyVariant);
  }
  if ("placement" in raw) patch.placement = parsePlacement(raw.placement);
  if (Object.keys(patch).length === 0) throw new Error("Nothing to change");
  return patch;
}

/** Largest price on one invoice line, in rupiah (Rp 1 billion). */
const MAX_LINE_PRICE_IDR = 1_000_000_000;
/** Most units of one custom line. */
const MAX_CUSTOM_QUANTITY = 1000;

function parsePrice(value: unknown, field: string): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > MAX_LINE_PRICE_IDR
  ) {
    throw new Error(`${field} must be a whole number of rupiah, 0 or more`);
  }
  return value;
}

function parseOptionalText(value: unknown, max: number, field: string) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new Error(`${field} must be text`);
  const text = value.trim();
  if (text.length > max) {
    throw new Error(`${field} must be at most ${max} characters`);
  }
  return text || null;
}

function parseInvoiceLine(entry: unknown): AdminInvoiceLineInDto {
  const raw = asRecord(entry);
  if (raw.type === "product") {
    return {
      type: "product",
      productId: parseProductId(raw.productId),
      quantity: parseQuantity(raw.quantity, 1),
      variantId: parseVariantId(raw.variantId),
      unitPriceIdr:
        raw.unitPriceIdr === undefined || raw.unitPriceIdr === null
          ? null
          : parsePrice(raw.unitPriceIdr, "unitPriceIdr"),
      description: parseOptionalText(raw.description, 1000, "description"),
    };
  }
  if (raw.type === "custom") {
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name) throw new Error("Each custom line needs a name");
    if (name.length > 120) {
      throw new Error("A line name must be at most 120 characters");
    }
    const quantity = parseQuantity(raw.quantity, 1);
    if (quantity > MAX_CUSTOM_QUANTITY) {
      throw new Error(`quantity must be at most ${MAX_CUSTOM_QUANTITY}`);
    }
    return {
      type: "custom",
      name,
      description: parseOptionalText(raw.description, 1000, "description"),
      unitPriceIdr: parsePrice(raw.unitPriceIdr, "unitPriceIdr"),
      quantity,
    };
  }
  throw new Error('Each line needs a type: "product" or "custom"');
}

/** Body: `{ lines: [...], dueDays?, notify? }`. */
export function parseAdminInvoiceInDto(body: unknown): AdminInvoiceInDto {
  const raw = asRecord(body);
  if (!Array.isArray(raw.lines)) throw new Error("lines must be a list");
  if (raw.lines.length > MAX_CHECKOUT_LINES) {
    throw new Error(`At most ${MAX_CHECKOUT_LINES} lines per invoice`);
  }
  const dueDays = raw.dueDays === undefined ? 7 : raw.dueDays;
  if (
    typeof dueDays !== "number" ||
    !Number.isInteger(dueDays) ||
    dueDays < 1 ||
    dueDays > 90
  ) {
    throw new Error("dueDays must be a whole number from 1 to 90");
  }
  return {
    lines: raw.lines.map(parseInvoiceLine),
    dueDays,
    notify: raw.notify !== false,
  };
}

/** `?page=&pageSize=` with sane bounds. */
export function parsePageQuery(query: Record<string, unknown>): {
  page: number;
  pageSize: number;
} {
  const page = Number(query.page);
  const pageSize = Number(query.pageSize);
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize:
      Number.isInteger(pageSize) && pageSize > 0 ? Math.min(50, pageSize) : 20,
  };
}
