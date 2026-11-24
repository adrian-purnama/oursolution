import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { VariantHost } from "../product/product.variants";
import { itemsAfterSwitch, upgradeOptions } from "./paddle.upgrade";

function product(): VariantHost {
  return {
    kind: "subscription",
    name: "Umami",
    priceIdr: 50_000,
    priceUsdCents: 500,
    paddlePriceId: "pri_base",
    durationDays: 35,
    variants: [
      {
        id: "v2",
        name: "Pro",
        specs: "",
        priceIdr: 100_000,
        priceUsdCents: 1000,
        paddlePriceId: "pri_pro",
        durationDays: 35,
      },
      {
        id: "v3",
        name: "Yearly",
        specs: "",
        priceIdr: 900_000,
        priceUsdCents: 9000,
        paddlePriceId: "pri_year",
        durationDays: 365,
      },
      {
        id: "v4",
        name: "Not abroad",
        specs: "",
        priceIdr: 70_000,
        priceUsdCents: null,
        paddlePriceId: null,
        durationDays: 35,
      },
    ],
  } as unknown as VariantHost;
}

describe("upgradeOptions", () => {
  it("offers other variants with a Paddle price and the same cycle", () => {
    const ids = upgradeOptions(product(), { variantId: null, durationDays: 35 }).map(
      (v) => v.id,
    );
    assert.deepEqual(ids, ["v2"]);
  });

  it("does not offer the variant the user is on", () => {
    const ids = upgradeOptions(product(), {
      variantId: "v2",
      durationDays: 35,
    }).map((v) => v.id);
    assert.deepEqual(ids, ["default"]);
  });
});

describe("itemsAfterSwitch", () => {
  it("keeps the other items and swaps the one price", () => {
    assert.deepEqual(itemsAfterSwitch(["pri_a", "pri_b"], "pri_a", "pri_c"), [
      { price_id: "pri_c", quantity: 1 },
      { price_id: "pri_b", quantity: 1 },
    ]);
  });
});
