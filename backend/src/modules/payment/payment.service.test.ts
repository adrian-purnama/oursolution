import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AlreadyOwnedError } from "../purchase/purchase.service";
import { PlanScheduleError } from "../userProduct/userProduct.planner";
import { PaymentService } from "./payment.service";
import {
  allowAllProvider,
  type ChargeResult,
  type PaymentProvider,
} from "./payment.provider";

type Update = { filter: unknown; update: { $set: Record<string, unknown> } };

const subscription = {
  id: "p1",
  name: "n8n hosting",
  kind: "subscription",
  priceIdr: 99_000,
  durationDays: 30,
  showOnPricingPage: true,
};

const oneTime = {
  id: "p2",
  name: "Lead scraper workflow",
  kind: "oneTime",
  priceIdr: 150_000,
  durationDays: null,
  showOnPricingPage: true,
};

function setup(
  opts: {
    product?: Record<string, unknown>;
    provider?: PaymentProvider;
    cannotSchedule?: boolean;
    alreadyOwned?: boolean;
  } = {},
) {
  const created: Record<string, unknown>[] = [];
  const updates: Update[] = [];
  const periods: unknown[] = [];
  const purchases: unknown[] = [];
  const plan = { startsAt: new Date(0), endsAt: new Date(1) };

  const service = new PaymentService({
    provider: opts.provider ?? allowAllProvider,
    // Only the fields checkout reads; the real one is a Mongoose document.
    products: {
      get: (async () => opts.product ?? subscription) as never,
    },
    userProducts: {
      planAppendFor: async () => {
        if (opts.cannotSchedule) throw new PlanScheduleError("no end");
        return plan;
      },
      grant: async (_userId, _productId, _plan, origin) => {
        periods.push(origin);
        return "period1";
      },
    },
    purchases: {
      owns: async () => opts.alreadyOwned ?? false,
      grant: async (_userId, _productId, origin) => {
        purchases.push(origin);
        return "purchase1";
      },
    },
    payments: {
      create: (async (doc: Record<string, unknown>) => {
        created.push(doc);
        return { id: "pay1" };
      }) as never,
      updateOne: (async (filter: unknown, update: Update["update"]) => {
        updates.push({ filter, update });
        return {};
      }) as never,
    },
  });

  return { service, created, updates, periods, purchases };
}

function providerReturning(result: ChargeResult): PaymentProvider {
  return { name: "fake", charge: async () => result };
}

describe("PaymentService.checkout: subscription", () => {
  it("records a paid payment and adds a period", async () => {
    const { service, created, updates, periods, purchases } = setup();
    const out = await service.checkout("u1", "p1");

    assert.deepEqual(out, {
      paymentId: "pay1",
      status: "paid",
      redirectUrl: null,
    });
    assert.equal(created[0]?.amountIdr, 99_000);
    assert.equal(created[0]?.durationDays, 30);
    assert.equal(created[0]?.provider, "allow-all");
    assert.deepEqual(periods[0], { source: "checkout", paymentId: "pay1" });
    assert.equal(purchases.length, 0);
    assert.equal(updates.at(-1)?.update.$set.status, "paid");
    assert.equal(updates.at(-1)?.update.$set.periodId, "period1");
  });

  it("refuses a product that is not on the pricing page", async () => {
    const { service, created } = setup({
      product: { ...subscription, showOnPricingPage: false },
    });
    await assert.rejects(() => service.checkout("u1", "p1"));
    assert.equal(created.length, 0);
  });

  it("charges nothing when the period could not be added", async () => {
    const { service, created } = setup({ cannotSchedule: true });
    await assert.rejects(() => service.checkout("u1", "p1"), PlanScheduleError);
    assert.equal(created.length, 0);
  });

  it("marks a refused charge failed and grants nothing", async () => {
    const { service, updates, periods } = setup({
      provider: providerReturning({ status: "failed", reason: "declined" }),
    });
    await assert.rejects(() => service.checkout("u1", "p1"), /declined/);
    assert.equal(updates.at(-1)?.update.$set.status, "failed");
    assert.equal(periods.length, 0);
  });

  it("leaves a pending charge for a later confirmation", async () => {
    const { service, periods } = setup({
      provider: providerReturning({
        status: "pending",
        reference: "r1",
        redirectUrl: "https://pay.example/r1",
      }),
    });
    const out = await service.checkout("u1", "p1");
    assert.equal(out.status, "pending");
    assert.equal(out.redirectUrl, "https://pay.example/r1");
    assert.equal(periods.length, 0);
  });
});

describe("PaymentService.checkout: one-time", () => {
  it("records a paid payment and a purchase, with no period", async () => {
    const { service, created, updates, periods, purchases } = setup({
      product: oneTime,
    });
    await service.checkout("u1", "p2");

    assert.equal(created[0]?.amountIdr, 150_000);
    assert.equal(created[0]?.durationDays, null);
    assert.deepEqual(purchases[0], { source: "checkout", paymentId: "pay1" });
    assert.equal(periods.length, 0);
    assert.equal(updates.at(-1)?.update.$set.purchaseId, "purchase1");
  });

  it("charges nothing when the user already owns it", async () => {
    const { service, created } = setup({
      product: oneTime,
      alreadyOwned: true,
    });
    await assert.rejects(() => service.checkout("u1", "p2"), AlreadyOwnedError);
    assert.equal(created.length, 0);
  });
});
