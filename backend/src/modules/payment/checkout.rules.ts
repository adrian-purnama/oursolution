/**
 * Pure checkout rules: how many of a product can be bought at once and what
 * a line costs. No database here, so they are easy to test.
 */
import type { ProductKind } from "../../models/product/product.interface";

/** Most periods of one subscription bought in one checkout. */
export const MAX_SUBSCRIPTION_QUANTITY = 12;
/** Most different products in one basket or checkout. */
export const MAX_CHECKOUT_LINES = 20;

export function maxQuantity(kind: ProductKind): number {
  return kind === "oneTime" ? 1 : MAX_SUBSCRIPTION_QUANTITY;
}

/** The quantity a line may have: a one-time product is always 1. */
export function clampQuantity(kind: ProductKind, quantity: number): number {
  const whole = Math.trunc(quantity);
  return Math.min(maxQuantity(kind), Math.max(1, whole));
}

export function lineAmount(unitPriceIdr: number, quantity: number): number {
  return unitPriceIdr * quantity;
}

/** Sum of line amounts, in whole rupiah. */
export function totalAmount(
  lines: { unitPriceIdr: number; quantity: number }[],
): number {
  return lines.reduce(
    (sum, line) => sum + lineAmount(line.unitPriceIdr, line.quantity),
    0,
  );
}

/** "INV-2026-000042". */
export function formatInvoiceNumber(year: number, seq: number): string {
  return `INV-${year}-${String(seq).padStart(6, "0")}`;
}

/** Same product twice in one request: merge, keeping the larger quantity. */
export function mergeDuplicateItems<
  T extends { productId: string; quantity: number },
>(items: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of items) {
    const seen = byId.get(item.productId);
    if (!seen || item.quantity > seen.quantity) byId.set(item.productId, item);
  }
  return [...byId.values()];
}
