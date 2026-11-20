import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { Types } from "mongoose";
import type { PaymentInterface } from "../../models/payment/payment.interface";
import { AlreadyOwnedError } from "../purchase/purchase.service";
import { PlanScheduleError } from "../userProduct/userProduct.planner";
import {
  clampQuantity,
  formatInvoiceNumber,
  mergeDuplicateItems,
  totalAmount,
} from "./checkout.rules";
import { MidtransProvider, midtransStatus } from "./midtrans.provider";
import {
  allowAllProvider,
  type ChargeRequest,
  type ChargeResult,
  type PaymentProvider,
  type ProviderStatus,
} from "./payment.provider";
import {
  CheckoutError,
  PaymentService,
  type PaymentRecord,
  type PaymentStore,
} from "./payment.service";

const USER = new Types.ObjectId().toString();
const SUB = new Types.ObjectId().toString();
const ONE = new Types.ObjectId().toString();

const subscription = {
  id: SUB,
  name: "n8n hosting",
  kind: "subscription",
  color: "#000000",
  images: [],
  priceIdr: 99_000,
  durationDays: 30,
  showOnPricingPage: true,
  deletedAt: null,
};

const oneTime = {
  id: ONE,
  name: "Lead scraper workflow",
  kind: "oneTime",
  color: "#000000",
  images: [],
  priceIdr: 150_000,
  durationDays: null,
  showOnPricingPage: true,
  deletedAt: null,
};

function paid(amountIdr: number | null): ProviderStatus {
  return {
    state: "paid",
    raw: "settlement",
    amountIdr,
    reference: "tx1",
    paymentType: "qris",
  };
}

/** A provider that leaves payments pending, like Midtrans Snap. */
function pendingProvider(charges: ChargeRequest[] = []): PaymentProvider {
  return {
    name: "midtrans",
    async charge(request) {
      charges.push(request);
      return {
        status: "pending",
        reference: null,
        redirectUrl: "https://pay.example/1",
        token: "snap-token-1",
      };
    },
    async fetchStatus() {
      return null;
    },
  };
}

function setup(
  opts: {
    products?: Record<string, Record<string, unknown>>;
    provider?: PaymentProvider | null;
    cannotSchedule?: boolean;
    owned?: boolean;
    subscribed?: boolean;
    /** The variant of the user's last period of the product. */
    latestVariant?: string;
  } = {},
) {
  const payments = new Map<string, PaymentRecord>();
  const periods: {
    paymentId: string;
    productId: string;
    id: string;
    variantId?: string;
    applyVariant?: string;
  }[] = [];
  /** Days asked of each planAppendFor call. */
  const plannedDays: number[] = [];
  /** Each switchNow call: the days bought and the variant. */
  const switches: { days: number; variantId: string; applyVariant: string }[] =
    [];
  const purchases: { productId: string; paymentId: string; id: string }[] = [];
  const granted: string[] = [];
  const products = opts.products ?? { [SUB]: subscription, [ONE]: oneTime };
  let seq = 0;

  const store: PaymentStore = {
    async create(doc) {
      const id = new Types.ObjectId().toString();
      payments.set(id, { ...doc, id, createdAt: new Date() });
      return id;
    },
    async get(id) {
      const p = payments.get(id);
      return p ? { ...p, items: p.items.map((i) => ({ ...i })) } : null;
    },
    async update(id, set, onlyIf) {
      const p = payments.get(id);
      if (!p || (onlyIf && !onlyIf.includes(p.status))) return false;
      payments.set(id, { ...p, ...set });
      return true;
    },
    async claimGrant(id, now) {
      const p = payments.get(id);
      if (!p || p.status !== "paid" || p.grantedAt || p.grantClaimedAt) {
        return null;
      }
      p.grantClaimedAt = now;
      return { ...p, items: p.items.map((i) => ({ ...i })) };
    },
    async pendingHolding(_userId, productIds, now, sources) {
      return [...payments.values()]
        .filter(
          (p) =>
            p.status === "pending" &&
            p.expiresAt > now &&
            (!sources || sources.includes(p.source)),
        )
        .flatMap((p) =>
          p.items.flatMap((item) => {
            const productId = item.productId?.toString();
            return productId && productIds.includes(productId)
              ? [{ invoiceNumber: p.invoiceNumber, productId }]
              : [];
          }),
        );
    },
    async pendingCheckouts() {
      return [...payments.values()].filter(
        (p) => p.status === "pending" && p.source !== "admin",
      );
    },
    async periodIdsFrom(paymentId, productId) {
      return periods
        .filter((p) => p.paymentId === paymentId && p.productId === productId)
        .map((p) => p.id);
    },
    async purchaseOf(_userId, productId) {
      const found = purchases.find((p) => p.productId === productId);
      return found ? { id: found.id, paymentId: found.paymentId } : null;
    },
  };

  const service = new PaymentService({
    provider: opts.provider === undefined ? pendingProvider() : opts.provider,
    // Only the fields checkout reads; the real one is a Mongoose document.
    products: {
      get: (async (id: string) => {
        const product = products[id];
        if (!product) throw new Error("Product not found");
        return product;
      }) as never,
    },
    userProducts: {
      hasLivePeriod: async () => opts.subscribed ?? false,
      latestVariantOf: async () => opts.latestVariant ?? null,
      planSwitchFor: async (_userId, _product, _variantId, days) => {
        if (opts.cannotSchedule) throw new PlanScheduleError("no end");
        const DAY = 24 * 60 * 60 * 1000;
        return {
          truncateId: "running",
          deleteIds: [],
          startsAt: new Date(0),
          endsAt: new Date((days + 7.5) * DAY),
          creditIdr: 25_000,
          bonusMs: 7.5 * DAY,
        };
      },
      switchNow: async (_userId, _product, days, origin, variant) => {
        switches.push({ days, ...variant });
        const id = new Types.ObjectId().toString();
        periods.push({
          paymentId: origin.source === "checkout" ? origin.paymentId : "",
          productId: SUB,
          id,
          ...variant,
        });
        return id;
      },
      planAppendFor: async (_userId, _productId, end) => {
        if (end.kind === "days") plannedDays.push(end.days);
        if (opts.cannotSchedule) throw new PlanScheduleError("no end");
        return { startsAt: new Date(0), endsAt: new Date(1) };
      },
      grant: async (_userId, productId, _plan, origin, variant) => {
        const id = new Types.ObjectId().toString();
        periods.push({
          paymentId: origin.source === "checkout" ? origin.paymentId : "",
          productId,
          id,
          variantId: variant?.variantId,
          applyVariant: variant?.applyVariant,
        });
        return id;
      },
    },
    purchases: {
      owns: async () => opts.owned ?? false,
      grant: async (_userId, productId, origin) => {
        if (purchases.some((p) => p.productId === productId)) {
          throw new AlreadyOwnedError("owned");
        }
        const id = new Types.ObjectId().toString();
        purchases.push({
          productId,
          paymentId: origin.source === "checkout" ? origin.paymentId : "",
          id,
        });
        return id;
      },
    },
    store,
    customerEmail: async () => "buyer@example.com",
    nextInvoiceNumber: async (now) =>
      formatInvoiceNumber(now.getUTCFullYear(), ++seq),
    onGranted: async (paymentId) => {
      granted.push(paymentId);
    },
    finishUrl: (id) => `https://app.example/billing/${id}`,
  });

  return {
    service,
    payments,
    periods,
    purchases,
    granted,
    plannedDays,
    switches,
  };
}

const basket = {
  items: [
    { productId: SUB, quantity: 3 },
    { productId: ONE, quantity: 1 },
  ],
  fromBasket: true,
};

describe("checkout rules", () => {
  it("keeps a one-time product at quantity 1 and caps subscriptions", () => {
    assert.equal(clampQuantity("oneTime", 5), 1);
    assert.equal(clampQuantity("subscription", 3), 3);
    assert.equal(clampQuantity("subscription", 99), 12);
    assert.equal(clampQuantity("subscription", 0), 1);
  });

  it("totals lines and numbers invoices", () => {
    assert.equal(
      totalAmount([
        { unitPriceIdr: 99_000, quantity: 3 },
        { unitPriceIdr: 150_000, quantity: 1 },
      ]),
      447_000,
    );
    assert.equal(formatInvoiceNumber(2026, 42), "INV-2026-000042");
  });

  it("merges the same product sent twice", () => {
    const merged = mergeDuplicateItems([
      { productId: "a", quantity: 1 },
      { productId: "a", quantity: 4 },
      { productId: "b", quantity: 2 },
    ]);
    assert.deepEqual(merged, [
      { productId: "a", quantity: 4 },
      { productId: "b", quantity: 2 },
    ]);
  });
});

describe("Midtrans", () => {
  it("maps transaction statuses", () => {
    assert.equal(
      midtransStatus({ transaction_status: "settlement" }).state,
      "paid",
    );
    assert.equal(
      midtransStatus({ transaction_status: "capture", fraud_status: "accept" })
        .state,
      "paid",
    );
    assert.equal(
      midtransStatus({
        transaction_status: "capture",
        fraud_status: "challenge",
      }).state,
      "review",
    );
    assert.equal(
      midtransStatus({ transaction_status: "expire" }).state,
      "expired",
    );
    assert.equal(
      midtransStatus({ transaction_status: "deny" }).state,
      "failed",
    );
    assert.equal(
      midtransStatus({ transaction_status: "refund" }).state,
      "refunded",
    );
    assert.equal(
      midtransStatus({ gross_amount: "447000.00" }).amountIdr,
      447_000,
    );
  });

  it("accepts only notifications signed with the server key", () => {
    const provider = new MidtransProvider({
      serverKey: "secret",
      sandbox: true,
      notificationUrl: null,
    });
    const n = {
      order_id: "abc",
      status_code: "200",
      gross_amount: "447000.00",
    };
    const good = createHash("sha512")
      .update("abc200447000.00secret")
      .digest("hex");
    assert.equal(provider.verifySignature({ ...n, signature_key: good }), true);
    assert.equal(
      provider.verifySignature({ ...n, signature_key: "0".repeat(128) }),
      false,
    );
    assert.equal(provider.verifySignature(n), false);
  });
});

describe("PaymentService.checkout", () => {
  it("creates one pending invoice for the whole basket and grants nothing yet", async () => {
    const charges: ChargeRequest[] = [];
    const { service, payments, periods, purchases } = setup({
      provider: pendingProvider(charges),
    });

    const out = await service.checkout(USER, basket);

    assert.equal(out.status, "pending");
    assert.equal(out.redirectUrl, "https://pay.example/1");
    assert.equal(out.snapToken, "snap-token-1");
    assert.match(out.invoiceNumber, /^INV-\d{4}-000001$/);
    const payment = payments.get(out.paymentId)!;
    assert.equal(payment.amountIdr, 3 * 99_000 + 150_000);
    assert.deepEqual(
      payment.items.map((i) => [i.name, i.quantity, i.amountIdr]),
      [
        ["n8n hosting", 3, 297_000],
        ["Lead scraper workflow", 1, 150_000],
      ],
    );
    assert.equal(charges[0]?.amountIdr, 447_000);
    assert.equal(charges[0]?.lines[0]?.quantity, 3);
    assert.equal(periods.length, 0);
    assert.equal(purchases.length, 0);
  });

  it("buys a one-time product once even when asked for more", async () => {
    const { service, payments } = setup();
    const out = await service.checkout(USER, {
      items: [{ productId: ONE, quantity: 4 }],
      fromBasket: false,
    });
    const payment = payments.get(out.paymentId)!;
    assert.equal(payment.items[0]?.quantity, 1);
    assert.equal(payment.amountIdr, 150_000);
  });

  it("is paid and granted at once by the allow-all provider", async () => {
    const { service, periods, purchases, payments, granted } = setup({
      provider: allowAllProvider,
    });
    const out = await service.checkout(USER, basket);
    assert.equal(out.status, "paid");
    assert.equal(periods.length, 3);
    assert.equal(purchases.length, 1);
    assert.ok(payments.get(out.paymentId)!.grantedAt);
    assert.deepEqual(granted, [out.paymentId]);
  });

  it("refuses without a provider", async () => {
    const { service, payments } = setup({ provider: null });
    await assert.rejects(() => service.checkout(USER, basket), CheckoutError);
    assert.equal(payments.size, 0);
  });

  for (const [label, opts] of [
    [
      "a hidden subscription to someone who does not have it",
      {
        products: { [SUB]: { ...subscription, showOnPricingPage: false } },
      },
    ],
    [
      "a deleted product",
      { products: { [SUB]: { ...subscription, deletedAt: new Date() } } },
    ],
    ["a subscription whose period cannot be added", { cannotSchedule: true }],
  ] as const) {
    it(`refuses ${label}, creating nothing`, async () => {
      const { service, payments } = setup(opts);
      await assert.rejects(
        () =>
          service.checkout(USER, {
            items: [{ productId: SUB, quantity: 1 }],
            fromBasket: false,
          }),
        CheckoutError,
      );
      assert.equal(payments.size, 0);
    });
  }

  it("lets a current subscriber extend a hidden subscription", async () => {
    const { service } = setup({
      products: { [SUB]: { ...subscription, showOnPricingPage: false } },
      subscribed: true,
    });
    const out = await service.checkout(USER, {
      items: [{ productId: SUB, quantity: 2 }],
      fromBasket: false,
    });
    assert.equal(out.status, "pending");
  });

  it("refuses a one-time product already owned or in an unpaid invoice", async () => {
    const owned = setup({ owned: true });
    await assert.rejects(
      () => owned.service.checkout(USER, basket),
      /already own/,
    );

    // An invoice an admin made holds the product.
    const held = setup();
    const invoice = await held.service.issueForUser(USER, {
      lines: [
        {
          type: "product",
          productId: ONE,
          quantity: 1,
          unitPriceIdr: null,
          description: null,
        },
      ],
      dueDays: 7,
      notify: false,
    });
    await assert.rejects(
      () => held.service.checkout(USER, basket),
      new RegExp(invoice.invoiceNumber),
    );
    assert.equal(held.payments.size, 1);
  });

  it("voids the user's earlier unpaid checkout when a new one is made", async () => {
    const expired: string[] = [];
    const provider: PaymentProvider = {
      ...pendingProvider(),
      async expire(paymentId) {
        expired.push(paymentId);
      },
    };
    const { service, payments } = setup({ provider });

    const first = await service.checkout(USER, basket);
    const adminInvoice = await service.issueForUser(USER, {
      lines: [
        {
          type: "custom",
          name: "Support",
          description: null,
          unitPriceIdr: 10_000,
          quantity: 1,
        },
      ],
      dueDays: 7,
      notify: false,
    });
    const second = await service.checkout(USER, basket);

    const voided = payments.get(first.paymentId)!;
    assert.equal(voided.status, "cancelled");
    assert.equal(voided.failureReason, `Replaced by ${second.invoiceNumber}`);
    assert.deepEqual(expired, [first.paymentId]);
    assert.equal(payments.get(second.paymentId)!.status, "pending");
    // An invoice an admin made stays open.
    assert.equal(payments.get(adminInvoice.paymentId)!.status, "pending");
  });

  it("keeps the earlier checkout when the new one fails", async () => {
    let fail = false;
    const base = pendingProvider();
    const provider: PaymentProvider = {
      ...base,
      async charge(request) {
        return fail
          ? { status: "failed", reason: "gateway down" }
          : base.charge(request);
      },
    };
    const { service, payments } = setup({ provider });
    const first = await service.checkout(USER, basket);
    fail = true;
    await assert.rejects(() => service.checkout(USER, basket), /gateway down/);
    assert.equal(payments.get(first.paymentId)!.status, "pending");
  });

  it("refuses a product that no longer exists", async () => {
    const { service } = setup({ products: { [SUB]: subscription } });
    await assert.rejects(() => service.checkout(USER, basket), CheckoutError);
  });

  it("records a refused charge as failed", async () => {
    const provider: PaymentProvider = {
      name: "midtrans",
      charge: async (): Promise<ChargeResult> => ({
        status: "failed",
        reason: "card declined",
      }),
      fetchStatus: async () => null,
    };
    const { service, payments } = setup({ provider });
    await assert.rejects(() => service.checkout(USER, basket), /card declined/);
    assert.equal([...payments.values()][0]?.status, "failed");
  });
});

describe("PaymentService: provider status", () => {
  it("grants every period and product once paid, only once", async () => {
    const { service, payments, periods, purchases, granted } = setup();
    const { paymentId } = await service.checkout(USER, basket);

    await service.applyProviderStatus(paymentId, paid(447_000), "notification");
    await service.applyProviderStatus(paymentId, paid(447_000), "poll");

    const payment = payments.get(paymentId)!;
    assert.equal(payment.status, "paid");
    assert.equal(payment.paymentType, "qris");
    assert.equal(periods.length, 3);
    assert.equal(purchases.length, 1);
    assert.equal(payment.items[0]?.periodIds.length, 3);
    assert.ok(payment.items[1]?.purchaseId);
    assert.equal(granted.length, 1);
  });

  it("finishes an interrupted grant without adding periods twice", async () => {
    const { service, payments, periods } = setup();
    const { paymentId } = await service.checkout(USER, basket);
    // A crash after one period was stored, before the grant was recorded.
    periods.push({
      paymentId,
      productId: SUB,
      id: new Types.ObjectId().toString(),
    });
    payments.set(paymentId, {
      ...payments.get(paymentId)!,
      status: "paid",
      paidAt: new Date(),
    });

    await service.refresh(paymentId);

    assert.equal(periods.length, 3);
    assert.ok(payments.get(paymentId)!.grantedAt);
  });

  it("flags an amount mismatch and grants nothing", async () => {
    const { service, payments, periods } = setup();
    const { paymentId } = await service.checkout(USER, basket);
    await service.applyProviderStatus(paymentId, paid(1_000), "notification");
    const payment = payments.get(paymentId)!;
    assert.equal(payment.status, "pending");
    assert.equal(payment.needsReview, true);
    assert.equal(periods.length, 0);
  });

  it("never moves a paid payment back to expired", async () => {
    const { service, payments } = setup();
    const { paymentId } = await service.checkout(USER, basket);
    await service.applyProviderStatus(paymentId, paid(null), "notification");
    await service.applyProviderStatus(
      paymentId,
      { ...paid(null), state: "expired", raw: "expire" },
      "notification",
    );
    assert.equal(payments.get(paymentId)!.status, "paid");
  });

  it("still grants a payment that arrives after the invoice was cancelled", async () => {
    const { service, payments, purchases } = setup();
    const { paymentId } = await service.checkout(USER, basket);
    await service.cancel(USER, paymentId);
    await service.applyProviderStatus(paymentId, paid(447_000), "notification");
    assert.equal(payments.get(paymentId)!.status, "paid");
    assert.equal(purchases.length, 1);
  });

  it("flags for review when a one-time product was already owned at grant time", async () => {
    const { service, payments, purchases } = setup();
    const { paymentId } = await service.checkout(USER, basket);
    purchases.push({ productId: ONE, paymentId: "other", id: "p-other" });
    await service.applyProviderStatus(paymentId, paid(447_000), "notification");
    const payment = payments.get(paymentId)!;
    assert.ok(payment.grantedAt);
    assert.equal(payment.needsReview, true);
    assert.match(payment.reviewNote ?? "", /already owned/);
  });

  it("expires an unpaid invoice well past its expiry", async () => {
    const { service, payments } = setup();
    const { paymentId } = await service.checkout(USER, basket);
    const later = new Date(Date.now() + 24 * 60 * 60_000);
    await service.refresh(paymentId, later);
    assert.equal(payments.get(paymentId)!.status, "expired");
  });

  it("hides another user's invoice", async () => {
    const { service } = setup();
    const { paymentId } = await service.checkout(USER, basket);
    await assert.rejects(
      () => service.getOwn(new Types.ObjectId().toString(), paymentId),
      /Invoice not found/,
    );
  });
});

// Keep the record type honest with the model.
const _shape: Omit<PaymentRecord, "id"> extends PaymentInterface
  ? true
  : false = true;
void _shape;

describe("PaymentService.issueForUser", () => {
  it("bills custom work and store products at an edited price", async () => {
    const charges: ChargeRequest[] = [];
    const { service, payments } = setup({
      provider: pendingProvider(charges),
      // Hidden from the store: an admin can still bill it.
      products: { [SUB]: { ...subscription, showOnPricingPage: false } },
    });
    const now = new Date("2026-01-01T00:00:00Z");
    const out = await service.issueForUser(
      USER,
      {
        lines: [
          {
            type: "custom",
            name: "Website build",
            description: "Landing page and CMS",
            unitPriceIdr: 2_500_000,
            quantity: 2,
          },
          {
            type: "product",
            productId: SUB,
            quantity: 3,
            unitPriceIdr: 50_000,
            description: null,
          },
        ],
        dueDays: 14,
        notify: false,
      },
      now,
    );

    assert.equal(out.status, "pending");
    const payment = payments.get(out.paymentId)!;
    assert.equal(payment.source, "admin");
    assert.equal(payment.amountIdr, 5_150_000);
    assert.equal(payment.items[0].kind, "custom");
    assert.equal(payment.items[0].productId, null);
    assert.equal(payment.items[0].description, "Landing page and CMS");
    assert.equal(payment.items[1].unitPriceIdr, 50_000);
    assert.equal(
      payment.expiresAt.getTime(),
      now.getTime() + 14 * 24 * 60 * 60_000,
    );
    assert.equal(charges[0].amountIdr, 5_150_000);
    assert.equal(charges[0].lines[0].id, "custom-1");
  });

  it("keeps the store price when none is given", async () => {
    const { service, payments } = setup();
    const out = await service.issueForUser(USER, {
      lines: [
        {
          type: "product",
          productId: ONE,
          quantity: 1,
          unitPriceIdr: null,
          description: null,
        },
      ],
      dueDays: 7,
      notify: false,
    });
    assert.equal(payments.get(out.paymentId)!.amountIdr, 150_000);
  });

  it("grants the products but nothing for custom lines once paid", async () => {
    const { service, payments, periods, granted } = setup({
      provider: allowAllProvider,
    });
    const out = await service.issueForUser(USER, {
      lines: [
        {
          type: "custom",
          name: "Consulting",
          description: null,
          unitPriceIdr: 100_000,
          quantity: 1,
        },
        {
          type: "product",
          productId: SUB,
          quantity: 2,
          unitPriceIdr: 0,
          description: null,
        },
      ],
      dueDays: 7,
      notify: false,
    });
    const payment = payments.get(out.paymentId)!;
    assert.equal(payment.status, "paid");
    assert.ok(payment.grantedAt);
    assert.equal(periods.length, 2);
    assert.equal(payment.items[0].periodIds.length, 0);
    assert.deepEqual(granted, [out.paymentId]);
  });

  it("refuses a one-time product the user already owns", async () => {
    const { service } = setup({ owned: true });
    await assert.rejects(
      service.issueForUser(USER, {
        lines: [
          {
            type: "product",
            productId: ONE,
            quantity: 1,
            unitPriceIdr: null,
            description: null,
          },
        ],
        dueDays: 7,
        notify: false,
      }),
      CheckoutError,
    );
  });
});

describe("PaymentService with variants", () => {
  const minecraft = {
    ...subscription,
    name: "Minecraft",
    variantName: "2 cores / 2 GB",
    variantSpecs: "",
    deployment: null,
    variants: [
      {
        id: "big",
        name: "4 cores / 4 GB",
        specs: "",
        priceIdr: 180_000,
        durationDays: 15,
        composeFile: null,
      },
    ],
  };
  const products = { [SUB]: minecraft };

  it("prices a line by its variant and lists every variant to pick from", async () => {
    const { service } = setup({ products });
    const quote = await service.quote(USER, [
      { productId: SUB, quantity: 2, variantId: "big", applyVariant: "manual" },
    ]);
    const [line] = quote.lines;
    assert.equal(line.unitPriceIdr, 180_000);
    assert.equal(line.durationDays, 15);
    assert.equal(line.amountIdr, 360_000);
    assert.deepEqual(line.variant, { id: "big", name: "4 cores / 4 GB" });
    assert.equal(line.applyVariant, "manual");
    assert.deepEqual(
      line.variants.map((v) => [v.id, v.unitPriceIdr]),
      [
        ["default", 99_000],
        ["big", 180_000],
      ],
    );
  });

  it("buys the base variant when none is given", async () => {
    const { service } = setup({ products });
    const [line] = (
      await service.quote(USER, [{ productId: SUB, quantity: 1 }])
    ).lines;
    assert.equal(line.variant?.id, "default");
    assert.equal(line.unitPriceIdr, 99_000);
    assert.equal(line.applyVariant, "auto");
  });

  it("extends the variant the user is on when none is named", async () => {
    const { service } = setup({ products, latestVariant: "big" });
    const [line] = (
      await service.quote(USER, [{ productId: SUB, quantity: 1 }])
    ).lines;
    assert.equal(line.variant?.id, "big");
    assert.equal(line.unitPriceIdr, 180_000);
  });

  it("flags a variant the product no longer has", async () => {
    const { service } = setup({ products });
    const quote = await service.quote(USER, [
      { productId: SUB, quantity: 1, variantId: "gone" },
    ]);
    assert.match(quote.lines[0].problem ?? "", /variant/);
    assert.equal(quote.canCheckout, false);
  });

  it("names the invoice line after the variant and grants periods on it", async () => {
    const { service, payments, periods, plannedDays } = setup({
      products,
      provider: allowAllProvider,
    });
    const out = await service.checkout(USER, {
      items: [
        {
          productId: SUB,
          quantity: 2,
          variantId: "big",
          applyVariant: "manual",
        },
      ],
      fromBasket: false,
    });
    const [item] = payments.get(out.paymentId)!.items;
    assert.equal(item.name, "Minecraft (4 cores / 4 GB)");
    assert.equal(item.variantId, "big");
    assert.equal(item.applyVariant, "manual");
    assert.equal(periods.length, 2);
    assert.ok(
      periods.every(
        (p) => p.variantId === "big" && p.applyVariant === "manual",
      ),
    );
    // Each period is the variant's length, not the product's.
    assert.ok(plannedDays.length > 0 && plannedDays.every((d) => d === 15));
  });

  it("shows what switching now does, and starts after by default", async () => {
    const { service } = setup({ products });
    const [later] = (
      await service.quote(USER, [
        { productId: SUB, quantity: 1, variantId: "big" },
      ])
    ).lines;
    assert.equal(later.placement, "after");
    assert.equal(later.switch, null);

    const [now] = (
      await service.quote(USER, [
        { productId: SUB, quantity: 2, variantId: "big", placement: "now" },
      ])
    ).lines;
    assert.equal(now.placement, "now");
    assert.deepEqual(now.switch, {
      creditIdr: 25_000,
      bonusDays: 7.5,
      endsAt: new Date((30 + 7.5) * 24 * 60 * 60 * 1000).toISOString(),
    });
  });

  it("flags a switch that cannot be done", async () => {
    const { service } = setup({ products, cannotSchedule: true });
    const quote = await service.quote(USER, [
      { productId: SUB, quantity: 1, variantId: "big", placement: "now" },
    ]);
    assert.equal(quote.lines[0].problem, "no end");
  });

  it("switches once for every unit bought when paid, and not again", async () => {
    const { service, payments, switches, plannedDays } = setup({
      products,
      provider: allowAllProvider,
    });
    const out = await service.checkout(USER, {
      items: [
        {
          productId: SUB,
          quantity: 2,
          variantId: "big",
          applyVariant: "manual",
          placement: "now",
        },
      ],
      fromBasket: false,
    });
    assert.deepEqual(switches, [
      { days: 30, variantId: "big", applyVariant: "manual" },
    ]);
    assert.deepEqual(plannedDays, []);
    const [item] = payments.get(out.paymentId)!.items;
    assert.equal(item.placement, "now");
    assert.equal(item.periodIds.length, 1);
    await service.grant(out.paymentId);
    assert.equal(switches.length, 1);
  });

  it("keeps the plain product name when there is no choice of variant", async () => {
    const { service, payments } = setup();
    const out = await service.checkout(USER, basket);
    assert.equal(payments.get(out.paymentId)!.items[0].name, "n8n hosting");
  });

  it("lets an admin invoice a variant at its price", async () => {
    const { service, payments } = setup({ products });
    const out = await service.issueForUser(USER, {
      lines: [
        {
          type: "product",
          productId: SUB,
          quantity: 1,
          variantId: "big",
          unitPriceIdr: null,
          description: null,
        },
      ],
      dueDays: 7,
      notify: false,
    });
    const [item] = payments.get(out.paymentId)!.items;
    assert.equal(item.unitPriceIdr, 180_000);
    assert.equal(item.durationDays, 15);
    assert.equal(item.variantId, "big");
    await assert.rejects(
      () =>
        service.issueForUser(USER, {
          lines: [
            {
              type: "product",
              productId: SUB,
              quantity: 1,
              variantId: "gone",
              unitPriceIdr: null,
              description: null,
            },
          ],
          dueDays: 7,
          notify: false,
        }),
      CheckoutError,
    );
  });
});
