import {
  variantIdOf,
  variantsOf,
  type ResolvedVariant,
  type VariantHost,
} from "../product/product.variants";

/** A subscription line, as far as changing its variant cares. */
export interface UpgradeLine {
  variantId: string | null;
  durationDays: number;
}

/**
 * The variants a subscription line can move to: every other variant sold
 * outside Indonesia with a Paddle price and the same billing cycle. Paddle
 * keeps one cycle per subscription, and the next charge date stays put.
 * Pure.
 */
export function upgradeOptions(
  product: VariantHost,
  line: UpgradeLine,
): ResolvedVariant[] {
  const current = variantIdOf(line.variantId);
  return variantsOf(product).filter(
    (variant) =>
      variant.id !== current &&
      variant.paddlePriceId !== null &&
      variant.priceUsdCents !== null &&
      variant.durationDays === line.durationDays,
  );
}

/**
 * The complete item list to send Paddle when one line changes price:
 * Paddle removes any item that is left out. Pure.
 */
export function itemsAfterSwitch(
  priceIds: readonly string[],
  fromPriceId: string,
  toPriceId: string,
): { price_id: string; quantity: number }[] {
  return priceIds.map((id) => ({
    price_id: id === fromPriceId ? toPriceId : id,
    quantity: 1,
  }));
}
