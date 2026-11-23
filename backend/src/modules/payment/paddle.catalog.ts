import type { HydratedDocument } from "mongoose";
import { env } from "../../environment/env";
import { logger } from "../../logger/logger";
import {
  BASE_VARIANT_ID,
  type ProductInterface,
} from "../../models/product/product.interface";
import { paddleClient, type PaddleClient, type PaddlePrice } from "./paddle.client";

const logSource = "modules/payment/paddle.catalog.ts";

type ProductDoc = HydratedDocument<ProductInterface>;

/** One price a product should have at Paddle. */
export interface WantedPrice {
  /** BASE_VARIANT_ID for the product's own price, else the variant's id. */
  variantId: string;
  name: string;
  /** Null: not sold outside Indonesia, so any Paddle price is archived. */
  cents: number | null;
  /** Subscription: Paddle bills every this many days. Null: one-time. */
  everyDays: number | null;
  /** The Paddle price synced last time, if any. */
  priceId: string | null;
}

/** Whether a Paddle price already charges what is wanted. Pure. */
export function priceMatches(price: PaddlePrice, wanted: WantedPrice): boolean {
  if (price.status !== "active") return false;
  if (price.unit_price.currency_code !== "USD") return false;
  if (price.unit_price.amount !== String(wanted.cents)) return false;
  if (wanted.everyDays === null) return price.billing_cycle === null;
  return (
    price.billing_cycle?.interval === "day" &&
    price.billing_cycle.frequency === wanted.everyDays
  );
}

/** The prices a product should have: its own, and each variant's. Pure. */
export function wantedPrices(product: ProductInterface): WantedPrice[] {
  const isSubscription = product.kind === "subscription";
  const base: WantedPrice = {
    variantId: BASE_VARIANT_ID,
    name: (product.variantName ?? "").trim() || product.name,
    cents: product.priceUsdCents ?? null,
    everyDays: isSubscription ? product.durationDays : null,
    priceId: product.paddlePriceId ?? null,
  };
  if (!isSubscription) return [base];
  return [
    base,
    ...(product.variants ?? []).map((variant) => ({
      variantId: variant.id,
      name: variant.name,
      cents: variant.priceUsdCents ?? null,
      everyDays: variant.durationDays,
      priceId: variant.paddlePriceId ?? null,
    })),
  ];
}

export class PaddleSyncError extends Error {}

/**
 * Bring a product's Paddle prices in step with its USD prices: create a
 * Paddle product the first time a USD price is set, create a price for each
 * new one, and archive the old price when an amount or duration changes
 * (Paddle keeps billing running subscriptions on the price they started
 * with). Saves the Paddle ids on the product. Does nothing without Paddle.
 * Throws PaddleSyncError when Paddle refuses; the product is already saved.
 */
export async function syncToPaddle(
  product: ProductDoc,
  client: PaddleClient | null = paddleClient,
): Promise<void> {
  if (!client) return;
  const wanted = wantedPrices(product);
  if (wanted.every((price) => price.cents === null && !price.priceId)) return;

  const productId = product.id as string;
  const results = new Map<string, string | null>();
  try {
    let paddleProductId = product.paddleProductId ?? null;
    const custom = { fedierProductId: productId };
    if (!paddleProductId) {
      const created = await client.request<{ id: string }>("POST", "/products", {
        name: product.name,
        tax_category: env.paddleTaxCategory,
        custom_data: custom,
      });
      paddleProductId = created.id;
      product.paddleProductId = paddleProductId;
    } else {
      await client.request("PATCH", `/products/${paddleProductId}`, {
        name: product.name,
        status: "active",
      });
    }

    for (const price of wanted) {
      let current: PaddlePrice | null = null;
      if (price.priceId) {
        current = await client.getPrice(price.priceId);
      }
      if (price.cents !== null && current && priceMatches(current, price)) {
        results.set(price.variantId, current.id);
        continue;
      }
      if (current && current.status === "active") {
        await client.request("PATCH", `/prices/${current.id}`, {
          status: "archived",
        });
      }
      if (price.cents === null) {
        results.set(price.variantId, null);
        continue;
      }
      const label =
        price.everyDays !== null
          ? `${price.name}, every ${price.everyDays} days`
          : price.name;
      const created = await client.request<{ id: string }>("POST", "/prices", {
        product_id: paddleProductId,
        name: price.name,
        description: label,
        unit_price: { amount: String(price.cents), currency_code: "USD" },
        // Tax is added on top, so what Paddle bills matches our invoice.
        tax_mode: "external",
        quantity: { minimum: 1, maximum: 1 },
        ...(price.everyDays !== null
          ? { billing_cycle: { interval: "day", frequency: price.everyDays } }
          : {}),
        custom_data: { ...custom, variantId: price.variantId },
      });
      results.set(price.variantId, created.id);
    }
  } catch (error) {
    // Keep what was already created, so the next save does not repeat it.
    await saveIds(product, results);
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      `Paddle sync of ${product.name} failed: ${message}`,
      logSource,
      "syncToPaddle",
    );
    throw new PaddleSyncError(
      `Saved, but Paddle could not be updated (${message}). Save again to retry.`,
    );
  }
  await saveIds(product, results);
}

async function saveIds(
  product: ProductDoc,
  ids: Map<string, string | null>,
): Promise<void> {
  if (ids.has(BASE_VARIANT_ID)) {
    product.paddlePriceId = ids.get(BASE_VARIANT_ID) ?? null;
  }
  for (const variant of product.variants ?? []) {
    if (ids.has(variant.id)) variant.paddlePriceId = ids.get(variant.id) ?? null;
  }
  await product.save();
}
