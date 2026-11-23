import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Types } from "mongoose";
import { toPricingProductOut, type ProductDoc } from "../product/product.service";
import { regionHint } from "./billingRegion";

describe("billing region from a request", () => {
  it("trusts Cloudflare's country first", () => {
    assert.equal(regionHint({ country: "ID" }), "ID");
    assert.equal(regionHint({ country: "id" }), "ID");
    assert.equal(regionHint({ country: "US" }), "INTL");
    assert.equal(
      regionHint({ country: "SG", timezone: "Asia/Jakarta" }),
      "INTL",
    );
  });

  it("falls back to the browser's time zone when the country is unknown", () => {
    assert.equal(regionHint({ country: "XX", timezone: "Asia/Makassar" }), "ID");
    assert.equal(regionHint({ country: "T1", timezone: "Europe/Berlin" }), "INTL");
    assert.equal(regionHint({ timezone: "Asia/Jayapura" }), "ID");
    assert.equal(regionHint({ timezone: "America/New_York" }), "INTL");
  });

  it("cannot tell without either", () => {
    assert.equal(regionHint({}), null);
    assert.equal(regionHint({ country: "", timezone: "" }), null);
    assert.equal(regionHint({ timezone: "garbage" }), null);
  });
});

/** Only the fields the public mapper reads. */
function product(over: Record<string, unknown>): ProductDoc {
  return {
    id: new Types.ObjectId().toString(),
    name: "Umami",
    kind: "subscription",
    color: "#000000",
    images: [],
    pricingText: "Rp 35.000 / month",
    description: "",
    notices: [],
    priceIdr: 35_000,
    priceUsdCents: 500,
    paddlePriceId: "pri_base",
    durationDays: 35,
    variantName: "Starter",
    variantSpecs: "",
    deployment: null,
    variants: [
      {
        id: "biz",
        name: "Business",
        specs: "",
        pricingText: "Rp 100.000 / month",
        description: "",
        priceIdr: 100_000,
        priceUsdCents: null,
        paddlePriceId: null,
        durationDays: 35,
        deployment: null,
        composeFile: null,
      },
    ],
    ...over,
  } as unknown as ProductDoc;
}

describe("the shop's prices by region", () => {
  it("shows Indonesia rupiah and the admin's texts", () => {
    const out = toPricingProductOut(product({}), "ID");
    assert.equal(out.currency, "IDR");
    assert.equal(out.price, 35_000);
    assert.equal(out.pricingText, "Rp 35.000 / month");
    assert.deepEqual(
      out.variants.map((v) => [v.id, v.price]),
      [
        ["default", 35_000],
        ["biz", 100_000],
      ],
    );
  });

  it("shows everyone else only US prices Paddle can charge, no rupiah", () => {
    const out = toPricingProductOut(product({}), "INTL");
    assert.equal(out.currency, "USD");
    assert.equal(out.price, 500);
    assert.equal(out.pricingText, "");
    assert.deepEqual(
      out.variants.map((v) => [v.id, v.price, v.pricingText]),
      [["default", 500, ""]],
    );
    assert.doesNotMatch(JSON.stringify(out), /35000|100000|Rp /);
  });

  it("has no price outside Indonesia until one is synced to Paddle", () => {
    const out = toPricingProductOut(product({ paddlePriceId: null }), "INTL");
    assert.equal(out.price, null);
    assert.deepEqual(out.variants, []);

    const oneTime = toPricingProductOut(
      product({ kind: "oneTime", variants: [], priceUsdCents: 2500, paddlePriceId: "pri_one" }),
      "INTL",
    );
    assert.equal(oneTime.price, 2500);
  });
});
