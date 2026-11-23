import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import type { ProductInterface } from "../../models/product/product.interface";
import { priceMatches, wantedPrices } from "./paddle.catalog";
import type { PaddlePrice, PaddleTransaction } from "./paddle.client";
import { paddleStatus, verifyPaddleSignature } from "./paddle.provider";

const SECRET = "pdl_ntfset_test_secret";
const NOW = 1_800_000_000;

function sign(body: string, ts: number, secret = SECRET): string {
  const h1 = createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex");
  return `ts=${ts};h1=${h1}`;
}

describe("Paddle webhook signature", () => {
  const body = '{"event_type":"transaction.completed"}';

  it("accepts a body signed with the secret", () => {
    assert.equal(verifyPaddleSignature(body, sign(body, NOW), SECRET, NOW), true);
    assert.equal(
      verifyPaddleSignature(Buffer.from(body), sign(body, NOW), SECRET, NOW),
      true,
    );
  });

  it("refuses a changed body, another secret or no header", () => {
    assert.equal(
      verifyPaddleSignature(`${body} `, sign(body, NOW), SECRET, NOW),
      false,
    );
    assert.equal(
      verifyPaddleSignature(body, sign(body, NOW, "other"), SECRET, NOW),
      false,
    );
    assert.equal(verifyPaddleSignature(body, undefined, SECRET, NOW), false);
    assert.equal(verifyPaddleSignature(body, "garbage", SECRET, NOW), false);
  });

  it("refuses an old signature, so it cannot be replayed", () => {
    const old = NOW - 10 * 60;
    assert.equal(verifyPaddleSignature(body, sign(body, old), SECRET, NOW), false);
  });

  it("accepts any of several signatures while a secret is rotated", () => {
    const good = sign(body, NOW).split(";")[1];
    const header = `ts=${NOW};h1=${"0".repeat(64)};${good}`;
    assert.equal(verifyPaddleSignature(body, header, SECRET, NOW), true);
  });
});

function txn(status: string, subtotal = "900"): PaddleTransaction {
  return {
    id: "txn_1",
    status,
    customer_id: "ctm_1",
    subscription_id: null,
    origin: "web",
    currency_code: "USD",
    custom_data: null,
    items: [],
    details: { totals: { subtotal } },
    payments: [{ method_details: { type: "card" } }],
    checkout: null,
  };
}

describe("Paddle transaction status", () => {
  it("grants only once Paddle has completed it", () => {
    assert.equal(paddleStatus(txn("completed")).state, "paid");
    assert.equal(paddleStatus(txn("paid")).state, "pending");
    assert.equal(paddleStatus(txn("ready")).state, "pending");
    assert.equal(paddleStatus(txn("past_due")).state, "pending");
    assert.equal(paddleStatus(txn("canceled")).state, "cancelled");
  });

  it("reports the tax-free subtotal in cents and how it was paid", () => {
    const status = paddleStatus(txn("completed", "3400"));
    assert.equal(status.amountIdr, 3400);
    assert.equal(status.reference, "txn_1");
    assert.equal(status.paymentType, "card");
  });
});

function price(over: Partial<PaddlePrice> = {}): PaddlePrice {
  return {
    id: "pri_1",
    product_id: "pro_1",
    status: "active",
    unit_price: { amount: "900", currency_code: "USD" },
    billing_cycle: { interval: "day", frequency: 35 },
    ...over,
  };
}

describe("Paddle price sync", () => {
  const wanted = {
    variantId: "default",
    name: "Umami",
    cents: 900,
    everyDays: 35,
    priceId: "pri_1",
  };

  it("keeps a price that already charges the same", () => {
    assert.equal(priceMatches(price(), wanted), true);
  });

  it("replaces a price whose amount, period or status changed", () => {
    assert.equal(priceMatches(price(), { ...wanted, cents: 1200 }), false);
    assert.equal(priceMatches(price(), { ...wanted, everyDays: 30 }), false);
    assert.equal(priceMatches(price({ status: "archived" }), wanted), false);
    assert.equal(
      priceMatches(price(), { ...wanted, everyDays: null }),
      false,
    );
    assert.equal(
      priceMatches(price({ billing_cycle: null }), { ...wanted, everyDays: null }),
      true,
    );
  });

  it("wants a price for the product and each variant", () => {
    const product = {
      kind: "subscription",
      name: "Umami",
      variantName: "Starter",
      priceUsdCents: 300,
      paddlePriceId: "pri_base",
      durationDays: 35,
      variants: [
        { id: "biz", name: "Business", priceUsdCents: null, paddlePriceId: "pri_old", durationDays: 35 },
      ],
    } as unknown as ProductInterface;
    assert.deepEqual(wantedPrices(product), [
      { variantId: "default", name: "Starter", cents: 300, everyDays: 35, priceId: "pri_base" },
      { variantId: "biz", name: "Business", cents: null, everyDays: 35, priceId: "pri_old" },
    ]);
  });

  it("wants a one-time price for a one-time product", () => {
    const product = {
      kind: "oneTime",
      name: "Workflow pack",
      variantName: "",
      priceUsdCents: 2500,
      paddlePriceId: null,
      durationDays: null,
      variants: [],
    } as unknown as ProductInterface;
    assert.deepEqual(wantedPrices(product), [
      { variantId: "default", name: "Workflow pack", cents: 2500, everyDays: null, priceId: null },
    ]);
  });
});
