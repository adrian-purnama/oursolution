import { Types } from "mongoose";
import type {
  AdminInvoiceInDto,
  CheckoutInDto,
  CheckoutItemInDto,
  CheckoutLineOutDto,
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
  PaymentItem,
  PaymentSource,
  PaymentStatus,
} from "../../models/payment/payment.interface";
import { PaymentModel } from "../../models/payment/payment.model";
import { PurchaseModel } from "../../models/purchase/purchase.model";
import { UserModel } from "../../models/user/user.model";
import { UserProductPeriodModel } from "../../models/userProductPeriod/userProductPeriod.model";
import { productService, toProductSummary } from "../product/product.service";
import {
  AlreadyOwnedError,
  purchaseService,
} from "../purchase/purchase.service";
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
}

type Deps = {
  /** Null when no provider is set up: checkout is refused. */
  provider: PaymentProvider | null;
  products: Pick<typeof productService, "get">;
  userProducts: Pick<
    typeof userProductService,
    "planAppendFor" | "grant" | "hasLivePeriod"
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
    amountIdr: payment.amountIdr,
    items: payment.items.map((item) => ({
      productId: item.productId?.toString() ?? null,
      name: item.name,
      description: item.description ?? null,
      kind: item.kind,
      unitPriceIdr: item.unitPriceIdr,
      quantity: item.quantity,
      durationDays: item.durationDays,
      amountIdr: item.amountIdr,
    })),
    provider: payment.provider,
    paymentType: payment.paymentType,
    redirectUrl: payable ? payment.redirectUrl : null,
    snapToken: payable ? payment.snapToken : null,
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

type PricedLine = CheckoutLineOutDto & { productDoc: Product };

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

  /** Price these items now, saying what stops each from being bought. */
  async quote(
    userId: string,
    items: CheckoutItemInDto[],
    now: Date = new Date(),
  ): Promise<CheckoutQuoteOutDto> {
    const lines = await this.priceLines(userId, items, now);
    return this.toQuote(lines);
  }

  private toQuote(lines: PricedLine[]): CheckoutQuoteOutDto {
    const out = lines.map(({ productDoc: _product, ...line }) => line);
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
  ): Promise<PricedLine[]> {
    const { products, userProducts, purchases, store } = this.deps;
    const items = mergeDuplicateItems(rawItems).slice(0, MAX_CHECKOUT_LINES);

    const found: { product: Product; quantity: number }[] = [];
    for (const item of items) {
      try {
        found.push({
          product: await products.get(item.productId),
          quantity: item.quantity,
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
    for (const { product, quantity: wanted } of found) {
      const productId = product.id as string;
      const quantity = clampQuantity(product.kind, wanted);
      let problem: string | null = null;

      if (product.deletedAt) {
        problem = "No longer available";
      } else if (
        !product.showOnPricingPage &&
        !(
          product.kind === "subscription" &&
          (await userProducts.hasLivePeriod(userId, productId, now))
        )
      ) {
        problem = "Not available for checkout";
      } else if (product.kind === "subscription") {
        if (!product.durationDays) {
          problem = "This subscription has no duration set";
        } else {
          try {
            await userProducts.planAppendFor(
              userId,
              productId,
              { kind: "days", days: product.durationDays },
              now,
            );
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
        product: toProductSummary(product),
        unitPriceIdr: product.priceIdr,
        quantity,
        maxQuantity: maxQuantity(product.kind),
        durationDays:
          product.kind === "subscription" ? product.durationDays : null,
        amountIdr: lineAmount(product.priceIdr, quantity),
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

    const lines = await this.priceLines(userId, input.items, now);
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
        name: line.product.name,
        description: null,
        kind: line.product.kind,
        unitPriceIdr: line.unitPriceIdr,
        quantity: line.quantity,
        durationDays: line.durationDays,
        amountIdr: line.amountIdr,
      })),
      new Date(now.getTime() + env.paymentTtlMinutes * 60_000),
      "checkout",
      now,
    );
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
    const { provider } = this.deps;
    if (!provider?.expire || provider.name !== payment.provider) return;
    try {
      await provider.expire(payment.id);
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
      throw new CheckoutError(`At most ${MAX_CHECKOUT_LINES} lines per invoice`);
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
          amountIdr: lineAmount(line.unitPriceIdr, line.quantity),
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
      if (product.kind === "subscription") {
        if (!product.durationDays) {
          throw new CheckoutError(
            `${product.name}: this subscription has no duration set`,
          );
        }
        try {
          await userProducts.planAppendFor(
            userId,
            productId,
            { kind: "days", days: product.durationDays },
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
      const unitPriceIdr = line.unitPriceIdr ?? product.priceIdr;
      lines.push({
        productId,
        name: product.name,
        description: line.description,
        kind: product.kind,
        unitPriceIdr,
        quantity,
        durationDays:
          product.kind === "subscription" ? product.durationDays : null,
        amountIdr: lineAmount(unitPriceIdr, quantity),
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
  ): Promise<CheckoutOutDto> {
    const { provider, store } = this.deps;
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
      status: "pending",
      source,
      provider: free ? "free" : provider!.name,
      reference: null,
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
        redirectUrl: null,
        snapToken: null,
      };
    }

    const result = await provider!.charge({
      paymentId,
      invoiceNumber,
      userId,
      customerEmail: await this.deps.customerEmail(userId),
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
        redirectUrl: null,
        snapToken: null,
      };
    }

    await store.update(paymentId, {
      reference: result.reference,
      redirectUrl: result.redirectUrl,
      snapToken: result.token,
    });
    return {
      paymentId,
      invoiceNumber,
      status: "pending",
      redirectUrl: result.redirectUrl,
      snapToken: result.token,
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
    const { store, userProducts, purchases } = this.deps;
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
          try {
            while (periodIds.length < item.quantity) {
              const plan = await userProducts.planAppendFor(userId, productId, {
                kind: "days",
                days: item.durationDays ?? 1,
              });
              periodIds.push(
                await userProducts.grant(userId, productId, plan, {
                  source: "checkout",
                  paymentId,
                }),
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
    const { store, provider } = this.deps;
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
    if (!provider || provider.name !== payment.provider) {
      if (pastGrace)
        await store.update(paymentId, { status: "expired" }, ["pending"]);
      return;
    }

    let status: ProviderStatus | null;
    try {
      status = await provider.fetchStatus(paymentId);
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
      await store.update(paymentId, { status: "expired" }, ["pending"]);
    }
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

/** Late-bound so payment.service does not import the mail module eagerly. */
let afterGrant: (paymentId: string) => Promise<void> = async () => {};
export function setAfterGrant(fn: (paymentId: string) => Promise<void>): void {
  afterGrant = fn;
}

export const paymentService = new PaymentService({
  provider: paymentProvider,
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
