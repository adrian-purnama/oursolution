import { Types } from "mongoose";
import type {
  AdminInvoiceInDto,
  AdminPaymentListOutDto,
  CheckoutInDto,
  CheckoutItemInDto,
  CheckoutLineOutDto,
  CheckoutSwitchOutDto,
  CheckoutOutDto,
  CheckoutQuoteOutDto,
  PaymentListOutDto,
  PaymentOutDto,
} from "../../dto/payment.dto";
import { env } from "../../environment/env";
import { logger } from "../../logger/logger";
import { nextSequence } from "../../models/counter/counter.model";
import type {
  PaymentInterface,
  CheckoutPlacement,
  PaymentCurrency,
  PaymentItem,
  PaymentSource,
  PaymentStatus,
} from "../../models/payment/payment.interface";
import { PaddleSubscriptionModel } from "../../models/paddleSubscription/paddleSubscription.model";
import type { BillingRegion } from "../../models/user/user.interface";
import { PaymentModel } from "../../models/payment/payment.model";
import { PurchaseModel } from "../../models/purchase/purchase.model";
import { UserModel } from "../../models/user/user.model";
import { UserProductPeriodModel } from "../../models/userProductPeriod/userProductPeriod.model";
import { escapeRegex } from "../../validation/adminUser";
import { productService, toProductSummary } from "../product/product.service";
import {
  AlreadyOwnedError,
  purchaseService,
} from "../purchase/purchase.service";
import type { VariantApplyMode } from "../../models/userProductPeriod/userProductPeriod.interface";

const DAY_MS = 24 * 60 * 60 * 1000;
import {
  lineName,
  variantIdOf,
  variantOf,
  variantsOf,
} from "../product/product.variants";
import { PlanScheduleError } from "../userProduct/userProduct.planner";
import { userProductService } from "../userProduct/userProduct.service";
import {
  clampQuantity,
  formatInvoiceNumber,
  lineAmount,
  MAX_CHECKOUT_LINES,
  maxQuantity,
  mergeDuplicateItems,
  totalAmount,
} from "./checkout.rules";
import { MidtransProvider } from "./midtrans.provider";
import { paddleClient } from "./paddle.client";
import { PaddleProvider } from "./paddle.provider";
import {
  allowAllProvider,
  type PaymentProvider,
  type ProviderStatus,
} from "./payment.provider";

const logSource = "modules/payment/payment.service.ts";

/** A grant held longer than this is assumed crashed and may be retried. */
const GRANT_CLAIM_STALE_MS = 2 * 60_000;
/** Ask the provider about one payment at most this often. */
const CHECK_THROTTLE_MS = 5_000;
/** Pending payments are kept this long past expiry for late settlements. */
const EXPIRY_GRACE_MS = 15 * 60_000;

/** A payment as the service works with it. */
export type PaymentRecord = PaymentInterface & { id: string };

type Product = Awaited<ReturnType<typeof productService.get>>;

/** Thrown when checkout is refused for a reason the user can fix. */
export class CheckoutError extends Error {}

/** Longest an admin invoice may stay open. */
export const MAX_INVOICE_DUE_DAYS = 90;

/** A priced line about to go on an invoice. */
type InvoiceLine = Omit<
  PaymentItem,
  "productId" | "periodIds" | "purchaseId"
> & {
  productId: string | null;
};

/** The currency a billing region pays in. */
export function currencyOf(region: BillingRegion): PaymentCurrency {
  return region === "INTL" ? "USD" : "IDR";
}

/** Paddle statuses that still renew, or are retrying a renewal. */
export const RENEWING_STATUSES = ["active", "trialing", "past_due"] as const;

/** A charge on a subscription that buys no new period. */
export interface ChargeInput {
  userId: string;
  subscriptionRef: string;
  /** Paddle's transaction id. Recording the same one twice does nothing. */
  reference: string;
  currency: PaymentCurrency;
  paymentType: string | null;
  /** The invoice line: what it was for. */
  name: string;
  description: string | null;
  /** Before tax: whole rupiah for IDR, cents for USD. */
  amount: number;
}

/** One renewal Paddle charged, to be recorded and granted. */
export interface RenewalInput {
  userId: string;
  /** Paddle's subscription id. */
  subscriptionRef: string;
  /** Paddle's transaction id. Recording the same one twice does nothing. */
  reference: string;
  currency: PaymentCurrency;
  paymentType: string | null;
  items: {
    productId: string;
    variantId: string | null;
    applyVariant: VariantApplyMode;
    name: string;
    durationDays: number;
    providerPriceId: string;
    unitPrice: number;
    quantity: number;
  }[];
}

/**
 * Where payments are stored. A small seam so the checkout and grant rules
 * can be tested without MongoDB; `mongoPaymentStore` is the real one.
 */
export interface PaymentStore {
  create(
    doc: Omit<PaymentInterface, "createdAt" | "updatedAt">,
  ): Promise<string>;
  get(id: string): Promise<PaymentRecord | null>;
  /** Set fields; with `onlyIf`, only while the payment has one of these statuses. Returns whether it changed. */
  update(
    id: string,
    set: Partial<PaymentInterface>,
    onlyIf?: PaymentStatus[],
  ): Promise<boolean>;
  /** Take the right to grant a paid payment. Null when granted or someone else holds it. */
  claimGrant(id: string, now: Date): Promise<PaymentRecord | null>;
  /**
   * Unpaid, unexpired invoices of this user that hold one of these
   * products; with `sources`, only invoices made that way.
   */
  pendingHolding(
    userId: string,
    productIds: string[],
    now: Date,
    sources?: PaymentSource[],
  ): Promise<{ invoiceNumber: string; productId: string }[]>;
  /** The user's unpaid invoices from their own checkouts. */
  pendingCheckouts(userId: string): Promise<PaymentRecord[]>;
  /** Periods this payment already created for a product. */
  periodIdsFrom(paymentId: string, productId: string): Promise<string[]>;
  purchaseOf(
    userId: string,
    productId: string,
  ): Promise<{ id: string; paymentId: string | null } | null>;
  /** The payment a provider knows by this transaction id. */
  findByReference(
    provider: string,
    reference: string,
  ): Promise<PaymentRecord | null>;
}

/** Where a user is billed, and whether that can still change. */
export interface BillingProfiles {
  regionOf(
    userId: string,
  ): Promise<{ region: BillingRegion; locked: boolean }>;
  /** Fix the region once the user has checked out in it. */
  lockRegion(userId: string, region: BillingRegion): Promise<void>;
  /** Whether Paddle renews this product for the user by itself. */
  renewsAutomatically(userId: string, productId: string): Promise<boolean>;
}

/** Everyone is billed in Indonesia: for tests and setups without Paddle. */
export const indonesiaOnly: BillingProfiles = {
  regionOf: async () => ({ region: "ID", locked: false }),
  lockRegion: async () => {},
  renewsAutomatically: async () => false,
};

type Deps = {
  /** Bills Indonesia (IDR). Null when none is set up: checkout is refused. */
  provider: PaymentProvider | null;
  /** Bills everyone else (USD). Null or missing: only Indonesia can buy. */
  paddle?: PaymentProvider | null;
  /** Missing: everyone is billed in Indonesia. */
  billing?: BillingProfiles;
  products: Pick<typeof productService, "get">;
  userProducts: Pick<
    typeof userProductService,
    | "planAppendFor"
    | "grant"
    | "hasLivePeriod"
    | "planSwitchFor"
    | "switchNow"
    | "latestVariantOf"
  >;
  purchases: Pick<typeof purchaseService, "owns" | "grant">;
  store: PaymentStore;
  customerEmail(userId: string): Promise<string>;
  nextInvoiceNumber(now: Date): Promise<string>;
  /** After products are granted: e.g. email the invoice. Errors are logged. */
  onGranted(paymentId: string): Promise<void>;
  finishUrl(paymentId: string): string;
};

function toRecord(
  doc: PaymentInterface & { _id: Types.ObjectId },
): PaymentRecord {
  return { ...doc, id: doc._id.toString() };
}

export const mongoPaymentStore: PaymentStore = {
  async create(doc) {
    const created = await PaymentModel.create(doc);
    return created.id as string;
  },
  async get(id) {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await PaymentModel.findById(id).lean().exec();
    return doc ? toRecord(doc) : null;
  },
  async update(id, set, onlyIf) {
    const result = await PaymentModel.updateOne(
      { _id: id, ...(onlyIf ? { status: { $in: onlyIf } } : {}) },
      { $set: set },
    ).exec();
    return result.modifiedCount > 0;
  },
  async claimGrant(id, now) {
    const doc = await PaymentModel.findOneAndUpdate(
      {
        _id: id,
        status: "paid",
        grantedAt: null,
        $or: [
          { grantClaimedAt: null },
          {
            grantClaimedAt: {
              $lte: new Date(now.getTime() - GRANT_CLAIM_STALE_MS),
            },
          },
        ],
      },
      { $set: { grantClaimedAt: now } },
      { returnDocument: "after" },
    )
      .lean()
      .exec();
    return doc ? toRecord(doc) : null;
  },
  async pendingHolding(userId, productIds, now, sources) {
    if (productIds.length === 0) return [];
    const docs = await PaymentModel.find({
      userId,
      status: "pending",
      expiresAt: { $gt: now },
      "items.productId": { $in: productIds },
      // Invoices from before sources existed were all checkouts.
      ...(sources
        ? sources.includes("checkout")
          ? { source: { $in: [...sources, null] } }
          : { source: { $in: sources } }
        : {}),
    })
      .select("invoiceNumber items.productId")
      .lean()
      .exec();
    return docs.flatMap((doc) =>
      doc.items.flatMap((item) => {
        const productId = item.productId?.toString();
        return productId && productIds.includes(productId)
          ? [{ invoiceNumber: doc.invoiceNumber, productId }]
          : [];
      }),
    );
  },
  async pendingCheckouts(userId) {
    const docs = await PaymentModel.find({
      userId,
      status: "pending",
      source: { $ne: "admin" },
    })
      .lean()
      .exec();
    return docs.map(toRecord);
  },
  async periodIdsFrom(paymentId, productId) {
    const ids = await UserProductPeriodModel.find({ paymentId, productId })
      .distinct("_id")
      .exec();
    return ids.map((id) => id.toString());
  },
  async purchaseOf(userId, productId) {
    const doc = await PurchaseModel.findOne({ userId, productId })
      .lean()
      .exec();
    if (!doc) return null;
    return {
      id: doc._id.toString(),
      paymentId: doc.paymentId?.toString() ?? null,
    };
  },
  async findByReference(provider, reference) {
    const doc = await PaymentModel.findOne({ provider, reference })
      .lean()
      .exec();
    return doc ? toRecord(doc) : null;
  },
};

export function toPaymentOut(
  payment: PaymentRecord,
  user: { id: string; email: string } | null = null,
  now: Date = new Date(),
): PaymentOutDto {
  const payable =
    payment.status === "pending" && payment.expiresAt.getTime() > now.getTime();
  return {
    id: payment.id,
    invoiceNumber: payment.invoiceNumber,
    status: payment.status,
    // Older documents read through `lean()` have no source yet.
    source: payment.source ?? "checkout",
    currency: payment.currency ?? "IDR",
    amountIdr: payment.amountIdr,
    items: payment.items.map((item) => ({
      productId: item.productId?.toString() ?? null,
      name: item.name,
      description: item.description ?? null,
      kind: item.kind,
      unitPriceIdr: item.unitPriceIdr,
      quantity: item.quantity,
      durationDays: item.durationDays,
      variantId: item.variantId ?? null,
      amountIdr: item.amountIdr,
    })),
    provider: payment.provider,
    paymentType: payment.paymentType,
    redirectUrl: payable ? payment.redirectUrl : null,
    snapToken: payable ? payment.snapToken : null,
    paddleTransactionId:
      payable && payment.provider === "paddle" ? payment.reference : null,
    expiresAt: payment.expiresAt.toISOString(),
    paidAt: payment.paidAt?.toISOString() ?? null,
    grantedAt: payment.grantedAt?.toISOString() ?? null,
    needsReview: payment.needsReview,
    reviewNote: payment.reviewNote,
    failureReason: payment.failureReason,
    createdAt: (payment.createdAt ?? now).toISOString(),
    user,
  };
}

type PricedLine = CheckoutLineOutDto & {
  productDoc: Product;
  providerPriceId: string | null;
};

/**
 * Checkout: a user pays for one or more products at once and gets one
 * invoice. Listed products are open to anyone; a subscription hidden from
 * pricing is open only to its current subscribers.
 *
 * - Each unit of a subscription adds one period of its duration after
 *   whatever the user already has of it.
 * - A one-time product is owned for good once paid, and can be bought once.
 * - Nothing is granted until the provider says the money is in.
 */
export class PaymentService {
  constructor(private readonly deps: Deps) {}

  private get billing(): BillingProfiles {
    return this.deps.billing ?? indonesiaOnly;
  }

  /** The provider a payment was made with, when it is still set up. */
  private providerNamed(name: string): PaymentProvider | null {
    const { provider, paddle } = this.deps;
    if (provider?.name === name) return provider;
    if (paddle?.name === name) return paddle;
    return null;
  }

  /** Where this user is billed; without Paddle, always Indonesia. */
  async regionOf(
    userId: string,
  ): Promise<{ region: BillingRegion; locked: boolean }> {
    const profile = await this.billing.regionOf(userId);
    return this.deps.paddle ? profile : { ...profile, region: "ID" };
  }

  /** Price these items now, saying what stops each from being bought. */
  async quote(
    userId: string,
    items: CheckoutItemInDto[],
    now: Date = new Date(),
  ): Promise<CheckoutQuoteOutDto> {
    const { region, locked } = await this.regionOf(userId);
    const lines = await this.priceLines(userId, items, now, region);
    return {
      ...this.toQuote(lines),
      currency: currencyOf(region),
      region,
      regionLocked: locked,
    };
  }

  private toQuote(
    lines: PricedLine[],
  ): Omit<CheckoutQuoteOutDto, "currency" | "region" | "regionLocked"> {
    const out = lines.map(
      ({ productDoc: _product, providerPriceId: _price, ...line }) => line,
    );
    return {
      lines: out,
      totalIdr: out
        .filter((line) => !line.problem)
        .reduce((sum, line) => sum + line.amountIdr, 0),
      canCheckout: out.length > 0 && out.every((line) => !line.problem),
    };
  }

  private async priceLines(
    userId: string,
    rawItems: CheckoutItemInDto[],
    now: Date,
    region: BillingRegion,
  ): Promise<PricedLine[]> {
    const { products, userProducts, purchases, store } = this.deps;
    const intl = region === "INTL";
    /** The billing period every subscription in one Paddle checkout shares. */
    let intlCycleDays: number | null = null;
    const items = mergeDuplicateItems(rawItems).slice(0, MAX_CHECKOUT_LINES);

    const found: {
      product: Product;
      quantity: number;
      variantId: string | null;
      applyVariant: VariantApplyMode;
      placement: CheckoutPlacement;
    }[] = [];
    for (const item of items) {
      try {
        const product = await products.get(item.productId);
        found.push({
          product,
          quantity: item.quantity,
          // No variant named: extend the one the user is on, else the base.
          variantId:
            item.variantId ??
            (product.kind === "subscription"
              ? await userProducts.latestVariantOf(userId, item.productId, now)
              : null),
          applyVariant: item.applyVariant ?? "auto",
          placement: item.placement ?? "after",
        });
      } catch {
        // Gone for good: nothing to show or buy.
      }
    }

    // The user's own unpaid checkouts do not block: a new checkout voids
    // them. An invoice an admin made does.
    const pending = await store.pendingHolding(
      userId,
      found
        .filter(({ product }) => product.kind === "oneTime")
        .map(({ product }) => product.id as string),
      now,
      ["admin"],
    );

    const lines: PricedLine[] = [];
    for (const {
      product,
      quantity: wanted,
      variantId,
      applyVariant,
      placement,
    } of found) {
      const productId = product.id as string;
      const isSubscription = product.kind === "subscription";
      // Paddle renews a subscription every period by itself: one at a time.
      const quantity =
        intl && isSubscription ? 1 : clampQuantity(product.kind, wanted);
      const variant = isSubscription ? variantOf(product, variantId) : null;
      // What the line costs: the chosen variant, or the product as it was.
      const unitPriceUsd = isSubscription
        ? (variant?.priceUsdCents ?? null)
        : (product.priceUsdCents ?? null);
      const providerPriceId = intl
        ? isSubscription
          ? (variant?.paddlePriceId ?? null)
          : (product.paddlePriceId ?? null)
        : null;
      const unitPriceIdr = intl
        ? (unitPriceUsd ?? 0)
        : (variant?.priceIdr ?? product.priceIdr);
      const durationDays = isSubscription
        ? (variant?.durationDays ?? product.durationDays)
        : null;
      let problem: string | null = null;
      let switchOut: CheckoutSwitchOutDto | null = null;

      if (product.deletedAt) {
        problem = "No longer available";
      } else if (isSubscription && !variant) {
        problem = "This variant is no longer available: choose another";
      } else if (intl && (unitPriceUsd === null || !providerPriceId)) {
        problem = "Not available outside Indonesia yet";
      } else if (intl && isSubscription && placement === "now") {
        problem =
          "Switching variant now is not available with automatic renewal: buy it to start after your current time";
      } else if (
        intl &&
        isSubscription &&
        (await this.billing.renewsAutomatically(userId, productId))
      ) {
        problem = "Already renews automatically: manage it from Billing";
      } else if (
        intl &&
        isSubscription &&
        intlCycleDays !== null &&
        durationDays !== intlCycleDays
      ) {
        problem =
          "Renews on a different schedule from the other subscriptions here: check it out on its own";
      } else if (
        !product.showOnPricingPage &&
        !(
          product.kind === "subscription" &&
          (await userProducts.hasLivePeriod(userId, productId, now))
        )
      ) {
        problem = "Not available for checkout";
      } else if (isSubscription) {
        if (!durationDays || !variant) {
          problem = "This subscription has no duration set";
        } else {
          try {
            if (placement === "now") {
              const plan = await userProducts.planSwitchFor(
                userId,
                product,
                variant.id,
                durationDays * quantity,
                now,
              );
              switchOut = {
                creditIdr: plan.creditIdr,
                bonusDays: Math.round((plan.bonusMs / DAY_MS) * 10) / 10,
                endsAt: plan.endsAt.toISOString(),
              };
            } else {
              await userProducts.planAppendFor(
                userId,
                productId,
                { kind: "days", days: durationDays },
                now,
              );
              if (intl) intlCycleDays = durationDays;
            }
          } catch (error) {
            if (!(error instanceof PlanScheduleError)) throw error;
            problem = error.message;
          }
        }
      } else if (await purchases.owns(userId, productId)) {
        problem = "You already own this";
      } else {
        const held = pending.find((p) => p.productId === productId);
        if (held) {
          problem = `Already in unpaid invoice ${held.invoiceNumber}: pay or cancel it first`;
        }
      }

      lines.push({
        productDoc: product,
        providerPriceId,
        product: toProductSummary(product),
        unitPriceIdr,
        quantity,
        maxQuantity: intl && isSubscription ? 1 : maxQuantity(product.kind),
        durationDays,
        amountIdr: lineAmount(unitPriceIdr, quantity),
        variant: variant ? { id: variant.id, name: variant.name } : null,
        variants: isSubscription
          ? variantsOf(product).flatMap((option) => {
              const price = intl ? option.priceUsdCents : option.priceIdr;
              // Outside Indonesia, only variants with a USD price are sold.
              if (price === null || (intl && !option.paddlePriceId)) return [];
              return [
                {
                  id: option.id,
                  name: option.name,
                  specs: option.specs,
                  unitPriceIdr: price,
                  durationDays: option.durationDays,
                },
              ];
            })
          : [],
        applyVariant: isSubscription ? applyVariant : null,
        placement: isSubscription ? placement : null,
        switch: switchOut,
        problem,
      });
    }
    return lines;
  }

  async checkout(
    userId: string,
    input: CheckoutInDto,
    now: Date = new Date(),
  ): Promise<CheckoutOutDto> {
    if (input.items.length === 0) {
      throw new CheckoutError("Choose at least one product");
    }
    if (input.items.length > MAX_CHECKOUT_LINES) {
      throw new CheckoutError(
        `At most ${MAX_CHECKOUT_LINES} products per checkout`,
      );
    }

    const { region } = await this.regionOf(userId);
    const lines = await this.priceLines(userId, input.items, now, region);
    if (lines.length < mergeDuplicateItems(input.items).length) {
      throw new CheckoutError("A product in your checkout no longer exists");
    }
    const blocked = lines.find((line) => line.problem);
    if (blocked) {
      throw new CheckoutError(`${blocked.product.name}: ${blocked.problem}`);
    }

    const created = await this.issue(
      userId,
      lines.map((line) => ({
        productId: line.product.id,
        name: lineName(line.productDoc, line.variant),
        description: null,
        kind: line.product.kind,
        unitPriceIdr: line.unitPriceIdr,
        quantity: line.quantity,
        durationDays: line.durationDays,
        variantId: line.variant?.id ?? null,
        applyVariant: line.applyVariant,
        placement: line.placement,
        amountIdr: line.amountIdr,
        providerPriceId: line.providerPriceId,
      })),
      new Date(now.getTime() + env.paymentTtlMinutes * 60_000),
      "checkout",
      now,
      currencyOf(region),
    );
    await this.billing.lockRegion(userId, region);
    await this.voidEarlierCheckouts(userId, created);
    return created;
  }

  /**
   * One open checkout per user: once a new one exists, the user's earlier
   * unpaid checkouts are cancelled and closed at the provider. Invoices an
   * admin made are left alone.
   */
  private async voidEarlierCheckouts(
    userId: string,
    created: CheckoutOutDto,
  ): Promise<void> {
    const earlier = (await this.deps.store.pendingCheckouts(userId)).filter(
      (payment) => payment.id !== created.paymentId,
    );
    for (const payment of earlier) {
      const voided = await this.deps.store.update(
        payment.id,
        {
          status: "cancelled",
          failureReason: `Replaced by ${created.invoiceNumber}`,
        },
        ["pending"],
      );
      if (!voided) continue;
      await this.expireAtProvider(payment);
      logger.info(
        `${payment.invoiceNumber} voided: replaced by ${created.invoiceNumber}`,
        logSource,
        "voidEarlierCheckouts",
      );
    }
  }

  /** Close a payment at its provider. Failures are logged, not thrown. */
  private async expireAtProvider(payment: PaymentRecord): Promise<void> {
    const provider = this.providerNamed(payment.provider);
    if (!provider?.expire) return;
    try {
      await provider.expire(payment.id, payment.reference);
    } catch (error) {
      // Paid anyway later: the late payment is still granted.
      logger.warn(
        `Could not close ${payment.invoiceNumber} at ${provider.name}: ${error instanceof Error ? error.message : String(error)}`,
        logSource,
        "expireAtProvider",
      );
    }
  }

  /**
   * An admin bills a user: store products at the store price or another
   * one, and custom lines (e.g. software work) that grant nothing. The user
   * pays it like any invoice; products are granted once paid.
   */
  async issueForUser(
    userId: string,
    input: AdminInvoiceInDto,
    now: Date = new Date(),
  ): Promise<CheckoutOutDto> {
    const { products, userProducts, purchases, store } = this.deps;
    if (input.lines.length === 0) {
      throw new CheckoutError("Add at least one line");
    }
    if (input.lines.length > MAX_CHECKOUT_LINES) {
      throw new CheckoutError(
        `At most ${MAX_CHECKOUT_LINES} lines per invoice`,
      );
    }
    // Fails for an unknown user before anything is stored.
    await this.deps.customerEmail(userId);

    const productIds = input.lines.flatMap((line) =>
      line.type === "product" ? [line.productId] : [],
    );
    if (new Set(productIds).size < productIds.length) {
      throw new CheckoutError("Each product can be on the invoice only once");
    }
    const pending = await store.pendingHolding(userId, productIds, now);

    const lines: InvoiceLine[] = [];
    for (const line of input.lines) {
      if (line.type === "custom") {
        lines.push({
          productId: null,
          name: line.name,
          description: line.description,
          kind: "custom",
          unitPriceIdr: line.unitPriceIdr,
          quantity: line.quantity,
          durationDays: null,
          variantId: null,
          applyVariant: null,
          placement: null,
          amountIdr: lineAmount(line.unitPriceIdr, line.quantity),
          providerPriceId: null,
        });
        continue;
      }

      let product: Product;
      try {
        product = await products.get(line.productId);
      } catch {
        throw new CheckoutError("A product on the invoice no longer exists");
      }
      const productId = product.id as string;
      if (product.deletedAt) {
        throw new CheckoutError(`${product.name}: no longer available`);
      }
      const isSubscription = product.kind === "subscription";
      const variant = isSubscription
        ? variantOf(product, line.variantId ?? null)
        : null;
      const durationDays = isSubscription
        ? (variant?.durationDays ?? null)
        : null;
      if (isSubscription) {
        if (!variant) {
          throw new CheckoutError(
            `${product.name}: the product has no such variant`,
          );
        }
        if (!durationDays) {
          throw new CheckoutError(
            `${product.name}: this subscription has no duration set`,
          );
        }
        try {
          await userProducts.planAppendFor(
            userId,
            productId,
            { kind: "days", days: durationDays },
            now,
          );
        } catch (error) {
          if (!(error instanceof PlanScheduleError)) throw error;
          throw new CheckoutError(`${product.name}: ${error.message}`);
        }
      } else {
        if (await purchases.owns(userId, productId)) {
          throw new CheckoutError(`${product.name}: the user already owns it`);
        }
        const held = pending.find((p) => p.productId === productId);
        if (held) {
          throw new CheckoutError(
            `${product.name}: already in unpaid invoice ${held.invoiceNumber}`,
          );
        }
      }

      const quantity = clampQuantity(product.kind, line.quantity);
      const unitPriceIdr =
        line.unitPriceIdr ?? variant?.priceIdr ?? product.priceIdr;
      lines.push({
        productId,
        name: lineName(product, variant),
        description: line.description,
        kind: product.kind,
        unitPriceIdr,
        quantity,
        durationDays,
        variantId: variant?.id ?? null,
        // An admin's invoice adds time after what the user has, and
        // applies a new variant by itself.
        applyVariant: isSubscription ? "auto" : null,
        placement: isSubscription ? "after" : null,
        amountIdr: lineAmount(unitPriceIdr, quantity),
        providerPriceId: null,
      });
    }

    const dueDays = Math.min(MAX_INVOICE_DUE_DAYS, Math.max(1, input.dueDays));
    return this.issue(
      userId,
      lines,
      new Date(now.getTime() + dueDays * 24 * 60 * 60_000),
      "admin",
      now,
    );
  }

  /** Store the invoice and start the payment; a free one is paid at once. */
  private async issue(
    userId: string,
    lines: InvoiceLine[],
    expiresAt: Date,
    source: PaymentSource,
    now: Date,
    currency: PaymentCurrency = "IDR",
  ): Promise<CheckoutOutDto> {
    const { store } = this.deps;
    const provider =
      currency === "USD" ? (this.deps.paddle ?? null) : this.deps.provider;
    const amountIdr = totalAmount(lines);
    const free = amountIdr === 0;
    if (!free && !provider) {
      throw new CheckoutError("Payments are not set up yet");
    }

    const items: PaymentItem[] = lines.map((line) => ({
      ...line,
      productId: line.productId ? new Types.ObjectId(line.productId) : null,
      periodIds: [],
      purchaseId: null,
    }));
    const invoiceNumber = await this.deps.nextInvoiceNumber(now);

    const paymentId = await store.create({
      userId: new Types.ObjectId(userId),
      invoiceNumber,
      items,
      amountIdr,
      currency,
      status: "pending",
      source,
      provider: free ? "free" : provider!.name,
      reference: null,
      subscriptionRef: null,
      redirectUrl: null,
      snapToken: null,
      paymentType: null,
      providerStatus: null,
      failureReason: null,
      expiresAt,
      paidAt: null,
      grantedAt: null,
      grantClaimedAt: null,
      checkedAt: null,
      needsReview: false,
      reviewNote: null,
    });

    if (free) {
      await this.markPaid(paymentId, { reference: null }, now);
      return {
        paymentId,
        invoiceNumber,
        status: "paid",
        provider: "free",
        redirectUrl: null,
        snapToken: null,
        paddleTransactionId: null,
      };
    }

    const result = await provider!.charge({
      paymentId,
      invoiceNumber,
      userId,
      customerEmail: await this.deps.customerEmail(userId),
      currency,
      amountIdr,
      // Free lines add nothing; payment gateways may refuse a zero price.
      lines: lines
        .filter((line) => line.unitPriceIdr > 0)
        .map((line, index) => ({
          id: line.productId ?? `custom-${index + 1}`,
          name:
            line.durationDays !== null
              ? `${line.name} (${line.durationDays} days)`
              : line.name,
          unitPriceIdr: line.unitPriceIdr,
          quantity: line.quantity,
          providerPriceId: line.providerPriceId ?? null,
        })),
      expiresAt,
      finishUrl: this.deps.finishUrl(paymentId),
    });

    if (result.status === "failed") {
      await store.update(paymentId, {
        status: "failed",
        failureReason: result.reason,
      });
      throw new Error(`Payment failed: ${result.reason}`);
    }

    if (result.status === "paid") {
      await this.markPaid(paymentId, { reference: result.reference }, now);
      logger.info(
        `Invoice ${invoiceNumber} paid via ${provider!.name}`,
        logSource,
        "issue",
      );
      return {
        paymentId,
        invoiceNumber,
        status: "paid",
        provider: provider!.name,
        redirectUrl: null,
        snapToken: null,
        paddleTransactionId: null,
      };
    }

    const isPaddle = provider!.name === "paddle";
    await store.update(paymentId, {
      reference: result.reference,
      redirectUrl: result.redirectUrl,
      snapToken: isPaddle ? null : result.token,
    });
    return {
      paymentId,
      invoiceNumber,
      status: "pending",
      provider: provider!.name,
      redirectUrl: result.redirectUrl,
      snapToken: isPaddle ? null : result.token,
      paddleTransactionId: isPaddle ? result.reference : null,
    };
  }

  /** Mark paid (once) and grant. Safe to call again. */
  private async markPaid(
    paymentId: string,
    fields: { reference: string | null; paymentType?: string | null },
    now: Date,
  ): Promise<void> {
    await this.deps.store.update(
      paymentId,
      {
        status: "paid",
        paidAt: now,
        ...(fields.reference ? { reference: fields.reference } : {}),
        ...(fields.paymentType ? { paymentType: fields.paymentType } : {}),
      },
      ["pending", "expired", "cancelled", "failed"],
    );
    await this.grant(paymentId, now);
  }

  /**
   * Grant what a paid payment bought. Idempotent: what was already granted
   * for this payment is found and not granted again, and only one caller
   * grants at a time.
   */
  async grant(paymentId: string, now: Date = new Date()): Promise<void> {
    const { store, userProducts, purchases, products } = this.deps;
    const payment = await store.claimGrant(paymentId, now);
    if (!payment) return;

    const userId = payment.userId.toString();
    const notes: string[] = [];
    const items: PaymentItem[] = [];

    try {
      for (const item of payment.items) {
        // A custom line is billed work: nothing to grant.
        if (item.kind === "custom" || !item.productId) {
          items.push(item);
          continue;
        }
        const productId = item.productId.toString();
        if (item.kind === "subscription") {
          const periodIds = await store.periodIdsFrom(paymentId, productId);
          const variant = {
            variantId: variantIdOf(item.variantId),
            applyVariant: item.applyVariant ?? "auto",
          };
          try {
            if (item.placement === "now") {
              // One period for every unit bought, worked out as of now.
              if (periodIds.length === 0) {
                periodIds.push(
                  await userProducts.switchNow(
                    userId,
                    await products.get(productId),
                    (item.durationDays ?? 1) * item.quantity,
                    { source: "checkout", paymentId },
                    variant,
                  ),
                );
              }
            }
            while (
              item.placement !== "now" &&
              periodIds.length < item.quantity
            ) {
              const plan = await userProducts.planAppendFor(userId, productId, {
                kind: "days",
                days: item.durationDays ?? 1,
              });
              periodIds.push(
                await userProducts.grant(
                  userId,
                  productId,
                  plan,
                  { source: "checkout", paymentId },
                  variant,
                ),
              );
            }
          } catch (error) {
            if (!(error instanceof PlanScheduleError)) throw error;
            notes.push(
              `${item.name}: granted ${periodIds.length} of ${item.quantity} periods (${error.message})`,
            );
          }
          items.push({
            ...item,
            periodIds: periodIds.map((id) => new Types.ObjectId(id)),
          });
        } else {
          let purchaseId: string | null = null;
          const owned = await store.purchaseOf(userId, productId);
          if (owned?.paymentId === paymentId) {
            purchaseId = owned.id;
          } else if (owned) {
            notes.push(`${item.name}: already owned, so not granted again`);
          } else {
            try {
              purchaseId = await purchases.grant(userId, productId, {
                source: "checkout",
                paymentId,
              });
            } catch (error) {
              if (!(error instanceof AlreadyOwnedError)) throw error;
              notes.push(`${item.name}: already owned, so not granted again`);
            }
          }
          items.push({
            ...item,
            purchaseId: purchaseId ? new Types.ObjectId(purchaseId) : null,
          });
        }
      }
    } catch (error) {
      await store.update(paymentId, { grantClaimedAt: null });
      logger.error(
        `Granting ${payment.invoiceNumber} failed: ${error instanceof Error ? error.message : String(error)}`,
        logSource,
        "grant",
      );
      throw error;
    }

    await store.update(paymentId, {
      items,
      grantedAt: now,
      grantClaimedAt: null,
      ...(notes.length > 0
        ? {
            needsReview: true,
            reviewNote: [payment.reviewNote, ...notes]
              .filter(Boolean)
              .join("\n"),
          }
        : {}),
    });
    if (notes.length > 0) {
      logger.error(
        `Paid ${payment.invoiceNumber} needs review: ${notes.join("; ")}`,
        logSource,
        "grant",
      );
    }

    try {
      await this.deps.onGranted(paymentId);
    } catch (error) {
      logger.error(
        `After-payment step for ${payment.invoiceNumber} failed: ${error instanceof Error ? error.message : String(error)}`,
        logSource,
        "grant",
      );
    }
  }

  /** Apply what the provider says about a payment. Idempotent. */
  async applyProviderStatus(
    paymentId: string,
    status: ProviderStatus,
    source: "notification" | "poll",
    now: Date = new Date(),
  ): Promise<void> {
    const { store } = this.deps;
    const payment = await store.get(paymentId);
    if (!payment) return;

    const known: Partial<PaymentInterface> = {
      providerStatus: status.raw || payment.providerStatus,
      ...(status.reference ? { reference: status.reference } : {}),
      ...(status.paymentType ? { paymentType: status.paymentType } : {}),
    };

    if (status.amountIdr !== null && status.amountIdr !== payment.amountIdr) {
      await store.update(paymentId, {
        ...known,
        needsReview: true,
        reviewNote: `Provider reported Rp ${status.amountIdr}, invoice is Rp ${payment.amountIdr} (${source})`,
      });
      logger.error(
        `Amount mismatch on ${payment.invoiceNumber} (${source})`,
        logSource,
        "applyProviderStatus",
      );
      return;
    }

    switch (status.state) {
      case "paid":
        await store.update(paymentId, known);
        if (payment.status !== "pending" && payment.status !== "paid") {
          logger.warn(
            `Late payment on ${payment.status} ${payment.invoiceNumber} (${source}); granting anyway`,
            logSource,
            "applyProviderStatus",
          );
        }
        await this.markPaid(
          paymentId,
          { reference: status.reference, paymentType: status.paymentType },
          now,
        );
        return;
      case "pending":
        await store.update(paymentId, known);
        return;
      case "expired":
      case "cancelled":
      case "failed":
        // A paid payment never goes back.
        await store.update(paymentId, { ...known, status: status.state }, [
          "pending",
        ]);
        return;
      case "refunded":
        await store.update(paymentId, {
          ...known,
          status: "refunded",
          needsReview: true,
          reviewNote: `Refunded or charged back at the provider (${status.raw}): remove access by hand if needed`,
        });
        logger.error(
          `${payment.invoiceNumber} was ${status.raw}`,
          logSource,
          "applyProviderStatus",
        );
        return;
      case "review":
        await store.update(paymentId, {
          ...known,
          needsReview: true,
          reviewNote: `Provider flagged the payment (${status.raw})`,
        });
        return;
    }
  }

  /**
   * Ask the provider how a pending payment stands, at most every few
   * seconds, and expire it once it is well past its expiry unpaid. Also
   * finishes granting a paid payment that was interrupted.
   */
  async refresh(paymentId: string, now: Date = new Date()): Promise<void> {
    const { store } = this.deps;
    const payment = await store.get(paymentId);
    if (!payment) return;

    if (payment.status === "paid" && !payment.grantedAt) {
      await this.grant(paymentId, now);
      return;
    }
    if (payment.status !== "pending") return;
    if (
      payment.checkedAt &&
      now.getTime() - payment.checkedAt.getTime() < CHECK_THROTTLE_MS
    ) {
      return;
    }
    await store.update(paymentId, { checkedAt: now });

    const pastGrace =
      now.getTime() > payment.expiresAt.getTime() + EXPIRY_GRACE_MS;
    const provider = this.providerNamed(payment.provider);
    if (!provider) {
      if (pastGrace)
        await store.update(paymentId, { status: "expired" }, ["pending"]);
      return;
    }

    let status: ProviderStatus | null;
    try {
      status = await provider.fetchStatus(paymentId, payment.reference);
    } catch (error) {
      logger.warn(
        `Status check for ${payment.invoiceNumber} failed: ${error instanceof Error ? error.message : String(error)}`,
        logSource,
        "refresh",
      );
      return;
    }

    if (status) {
      await this.applyProviderStatus(paymentId, status, "poll", now);
    }
    if ((!status || status.state === "pending") && pastGrace) {
      const expired = await store.update(paymentId, { status: "expired" }, [
        "pending",
      ]);
      // Paddle keeps a transaction open until it is cancelled.
      if (expired) await this.expireAtProvider(payment);
    }
  }

  /**
   * Record a renewal Paddle charged by itself as a paid invoice, and grant
   * one more period of each item after what the user has. Safe to call
   * again for the same transaction. Returns the payment's id.
   */
  async recordRenewal(
    input: RenewalInput,
    now: Date = new Date(),
  ): Promise<string> {
    const { store } = this.deps;
    const known = await store.findByReference("paddle", input.reference);
    if (known) {
      if (known.status === "paid" && !known.grantedAt) {
        await this.grant(known.id, now);
      }
      return known.id;
    }

    const items: PaymentItem[] = input.items.map((item) => ({
      productId: new Types.ObjectId(item.productId),
      name: item.name,
      description: null,
      kind: "subscription",
      unitPriceIdr: item.unitPrice,
      quantity: item.quantity,
      durationDays: item.durationDays,
      variantId: item.variantId,
      applyVariant: item.applyVariant,
      placement: "after",
      amountIdr: lineAmount(item.unitPrice, item.quantity),
      providerPriceId: item.providerPriceId,
      periodIds: [],
      purchaseId: null,
    }));
    let paymentId: string;
    try {
      paymentId = await store.create({
        userId: new Types.ObjectId(input.userId),
        invoiceNumber: await this.deps.nextInvoiceNumber(now),
        items,
        amountIdr: totalAmount(items),
        currency: input.currency,
        status: "pending",
        source: "renewal",
        provider: "paddle",
        reference: input.reference,
        subscriptionRef: input.subscriptionRef,
        redirectUrl: null,
        snapToken: null,
        paymentType: input.paymentType,
        providerStatus: "completed",
        failureReason: null,
        expiresAt: now,
        paidAt: null,
        grantedAt: null,
        grantClaimedAt: null,
        checkedAt: null,
        needsReview: false,
        reviewNote: null,
      });
    } catch (error) {
      // Another delivery of the same webhook recorded it first.
      const raced = await store.findByReference("paddle", input.reference);
      if (raced) return raced.id;
      throw error;
    }
    await this.markPaid(paymentId, { reference: input.reference }, now);
    logger.info(
      `Renewal ${input.reference} of ${input.subscriptionRef} recorded`,
      logSource,
      "recordRenewal",
    );
    return paymentId;
  }

  /**
   * Record a charge Paddle made on a subscription that buys no new period
   * (a plan change billed for the rest of the period) as a paid invoice with
   * one custom line. Nothing is granted. Safe to call again for the same
   * transaction. Returns the payment's id.
   */
  async recordCharge(
    input: ChargeInput,
    now: Date = new Date(),
  ): Promise<string> {
    const { store } = this.deps;
    const known = await store.findByReference("paddle", input.reference);
    if (known) return known.id;

    const items: PaymentItem[] = [
      {
        productId: null,
        name: input.name,
        description: input.description,
        kind: "custom",
        unitPriceIdr: input.amount,
        quantity: 1,
        durationDays: null,
        variantId: null,
        applyVariant: null,
        placement: null,
        amountIdr: input.amount,
        providerPriceId: null,
        periodIds: [],
        purchaseId: null,
      },
    ];
    let paymentId: string;
    try {
      paymentId = await store.create({
        userId: new Types.ObjectId(input.userId),
        invoiceNumber: await this.deps.nextInvoiceNumber(now),
        items,
        amountIdr: totalAmount(items),
        currency: input.currency,
        status: "pending",
        source: "renewal",
        provider: "paddle",
        reference: input.reference,
        subscriptionRef: input.subscriptionRef,
        redirectUrl: null,
        snapToken: null,
        paymentType: input.paymentType,
        providerStatus: "completed",
        failureReason: null,
        expiresAt: now,
        paidAt: null,
        grantedAt: null,
        grantClaimedAt: null,
        checkedAt: null,
        needsReview: false,
        reviewNote: null,
      });
    } catch (error) {
      // Another delivery of the same webhook recorded it first.
      const raced = await store.findByReference("paddle", input.reference);
      if (raced) return raced.id;
      throw error;
    }
    // Paid and settled in one step: there is nothing to grant.
    await store.update(
      paymentId,
      { status: "paid", paidAt: now, grantedAt: now },
      ["pending"],
    );
    logger.info(
      `Charge ${input.reference} of ${input.subscriptionRef} recorded`,
      logSource,
      "recordCharge",
    );
    return paymentId;
  }

  /** The user gives up on an unpaid invoice. */
  async cancel(userId: string, paymentId: string): Promise<PaymentOutDto> {
    const payment = await this.getOwn(userId, paymentId);
    if (payment.status !== "pending") {
      throw new CheckoutError("Only an unpaid invoice can be cancelled");
    }
    const cancelled = await this.deps.store.update(
      paymentId,
      { status: "cancelled" },
      ["pending"],
    );
    if (cancelled) await this.expireAtProvider(payment);
    return toPaymentOut((await this.deps.store.get(paymentId))!);
  }

  /** One of the user's own payments; someone else's reads as not found. */
  async getOwn(userId: string, paymentId: string): Promise<PaymentRecord> {
    const payment = await this.deps.store.get(paymentId);
    if (!payment || payment.userId.toString() !== userId) {
      throw new Error("Invoice not found");
    }
    return payment;
  }
}

/** Midtrans when a server key is set; otherwise free approval in development only. */
function chooseProvider(): PaymentProvider | null {
  if (env.midtransServerKey) {
    return new MidtransProvider({
      serverKey: env.midtransServerKey,
      sandbox: env.midtransSandbox,
      notificationUrl: env.midtransNotificationUrl,
    });
  }
  return env.isDevelopment ? allowAllProvider : null;
}

export const paymentProvider = chooseProvider();

/** Paddle, for customers outside Indonesia, when its API key is set. */
export const paddleProvider: PaddleProvider | null = paddleClient
  ? new PaddleProvider(paddleClient)
  : null;

export const mongoBillingProfiles: BillingProfiles = {
  async regionOf(userId) {
    const user = await UserModel.findById(userId)
      .select("billingRegion billingRegionLocked")
      .lean()
      .exec();
    return {
      region: user?.billingRegion ?? "ID",
      locked: user?.billingRegionLocked ?? false,
    };
  },
  async lockRegion(userId, region) {
    await UserModel.updateOne(
      { _id: userId, billingRegionLocked: { $ne: true } },
      { $set: { billingRegion: region, billingRegionLocked: true } },
    ).exec();
  },
  async renewsAutomatically(userId, productId) {
    const found = await PaddleSubscriptionModel.exists({
      userId,
      status: { $in: [...RENEWING_STATUSES] },
      cancelsAt: null,
      "items.productId": productId,
    });
    return Boolean(found);
  },
};

/** Late-bound so payment.service does not import the mail module eagerly. */
let afterGrant: (paymentId: string) => Promise<void> = async () => {};
export function setAfterGrant(fn: (paymentId: string) => Promise<void>): void {
  afterGrant = fn;
}

export const paymentService = new PaymentService({
  provider: paymentProvider,
  paddle: paddleProvider,
  billing: mongoBillingProfiles,
  products: productService,
  userProducts: userProductService,
  purchases: purchaseService,
  store: mongoPaymentStore,
  async customerEmail(userId) {
    const user = await UserModel.findById(userId).select("email").lean().exec();
    if (!user) throw new Error("User not found");
    return user.email;
  },
  async nextInvoiceNumber(now) {
    const year = now.getUTCFullYear();
    return formatInvoiceNumber(year, await nextSequence(`invoice-${year}`));
  },
  onGranted: (paymentId) => afterGrant(paymentId),
  finishUrl: (paymentId) =>
    `${env.frontendUrl.replace(/\/+$/, "")}/billing/${paymentId}`,
});

/** Lists for the billing pages. */
export async function listPayments(
  filter: { userId?: string; unpaidOnly?: boolean },
  page: number,
  pageSize: number,
  withUser: boolean,
): Promise<PaymentListOutDto> {
  const query = {
    ...(filter.userId ? { userId: filter.userId } : {}),
    // Unpaid and still payable: kept past expiry only for late settlements.
    ...(filter.unpaidOnly
      ? { status: "pending" as const, expiresAt: { $gt: new Date() } }
      : {}),
  };
  return pagePayments(query, page, pageSize, withUser);
}

/** Admin list groups: paid, unpaid, closed without paying, refunded. */
export const PAYMENT_GROUPS = {
  paid: ["paid"],
  pending: ["pending"],
  closed: ["failed", "expired", "cancelled"],
  refunded: ["refunded"],
} as const satisfies Record<string, readonly PaymentStatus[]>;
export type PaymentGroup = keyof typeof PAYMENT_GROUPS;

/**
 * Admin: every payment, filtered by group and searched by email or invoice
 * number. Each word of the search must appear somewhere in the email, so
 * "adrian gmail" finds adrian.p@gmail.com. Counts per group follow the search.
 */
export async function listAllPayments(
  filter: { group: PaymentGroup | null; search: string },
  page: number,
  pageSize: number,
): Promise<AdminPaymentListOutDto> {
  const base: Record<string, unknown> = {};
  const words = filter.search.trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    const users = await UserModel.find({
      $and: words.map((word) => ({
        email: { $regex: escapeRegex(word), $options: "i" },
      })),
    })
      .select("_id")
      .limit(1000)
      .lean()
      .exec();
    base.$or = [
      { userId: { $in: users.map((user) => user._id) } },
      {
        invoiceNumber: {
          $regex: escapeRegex(filter.search.trim()),
          $options: "i",
        },
      },
    ];
  }
  const query = filter.group
    ? { ...base, status: { $in: [...PAYMENT_GROUPS[filter.group]] } }
    : base;
  const [list, byStatus] = await Promise.all([
    pagePayments(query, page, pageSize, true),
    PaymentModel.aggregate<{ _id: PaymentStatus; n: number }>([
      { $match: base },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]).exec(),
  ]);
  const counts = { all: 0, paid: 0, pending: 0, closed: 0, refunded: 0 };
  for (const { _id, n } of byStatus) {
    counts.all += n;
    for (const [group, statuses] of Object.entries(PAYMENT_GROUPS)) {
      if ((statuses as readonly string[]).includes(_id)) {
        counts[group as PaymentGroup] += n;
      }
    }
  }
  return { ...list, counts };
}

async function pagePayments(
  query: Record<string, unknown>,
  page: number,
  pageSize: number,
  withUser: boolean,
): Promise<PaymentListOutDto> {
  const [total, docs] = await Promise.all([
    PaymentModel.countDocuments(query).exec(),
    PaymentModel.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean()
      .exec(),
  ]);
  const users = withUser
    ? new Map(
        (
          await UserModel.find({
            _id: { $in: [...new Set(docs.map((d) => d.userId.toString()))] },
          })
            .select("email")
            .lean()
            .exec()
        ).map((u) => [u._id.toString(), u.email]),
      )
    : null;
  return {
    items: docs.map((doc) => {
      const record = toRecord(doc);
      const email = users?.get(record.userId.toString());
      return toPaymentOut(
        record,
        email ? { id: record.userId.toString(), email } : null,
      );
    }),
    page,
    pageSize,
    total,
  };
}
