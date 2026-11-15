import { Types } from "mongoose";
import type {
  AdminInvoiceInDto,
  AdminInvoiceLineInDto,
  CheckoutInDto,
  CheckoutItemInDto,
  CheckoutQuoteInDto,
} from "../dto/payment.dto";
import { MAX_CHECKOUT_LINES } from "../modules/payment/checkout.rules";

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
    };
  });
}

/** Body: `{ items: [{ productId, quantity }], fromBasket? }`. */
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

/** Body: `{ productId, quantity? }`. */
export function parseBasketAddInDto(body: unknown): CheckoutItemInDto {
  const raw = asRecord(body);
  return {
    productId: parseProductId(raw.productId),
    quantity: parseQuantity(raw.quantity, 1),
  };
}

/** Body: `{ quantity }`. */
export function parseBasketQuantityInDto(body: unknown): number {
  return parseQuantity(asRecord(body).quantity);
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
