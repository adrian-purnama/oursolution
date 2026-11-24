import { Types } from "mongoose";
import type {
  PaddleSubscriptionOutDto,
  UpgradeChoiceOutDto,
  UpgradePreviewOutDto,
} from "../../dto/payment.dto";
import { logger } from "../../logger/logger";
import type { PaymentCurrency } from "../../models/payment/payment.interface";
import type {
  PaddleSubscriptionInterface,
  PaddleSubscriptionItem,
  PaddleSubscriptionStatus,
} from "../../models/paddleSubscription/paddleSubscription.interface";
import { PADDLE_SUBSCRIPTION_STATUSES } from "../../models/paddleSubscription/paddleSubscription.interface";
import { PaddleSubscriptionModel } from "../../models/paddleSubscription/paddleSubscription.model";
import { ProductModel } from "../../models/product/product.model";
import { lineName, variantOf, variantsOf } from "../product/product.variants";
import { itemsAfterSwitch, upgradeOptions } from "./paddle.upgrade";
import { publicFileUrl } from "../../buckets/publicBucket";
import { PurchaseModel } from "../../models/purchase/purchase.model";
import { UserProductPeriodModel } from "../../models/userProductPeriod/userProductPeriod.model";
import type { PaddleClient, PaddleTransaction } from "./paddle.client";
import { PaddleApiError, paddleClient } from "./paddle.client";
import { env } from "../../environment/env";
import { mailer } from "../mail/mail.service";
import {
  absoluteLink,
  notificationService,
} from "../notification/notification.service";
import { paddleStatus } from "./paddle.provider";
import {
  mongoPaymentStore,
  paymentService,
  type PaymentService,
  RENEWING_STATUSES,
  type PaymentRecord,
  type PaymentStore,
} from "./payment.service";

const logSource = "modules/payment/paddle.service.ts";

/** A webhook Paddle sends (the fields we read). */
export interface PaddleEvent {
  event_id?: string;
  event_type?: string;
  data?: Record<string, unknown>;
}

/** A Paddle subscription as a webhook carries it (the fields we read). */
interface PaddleSubscriptionData {
  id: string;
  status: string;
  customer_id: string;
  next_billed_at: string | null;
  canceled_at: string | null;
  scheduled_change: { action: string; effective_at: string } | null;
  custom_data: Record<string, unknown> | null;
}

/** A renewal transaction's item, with the price Paddle billed. */
type TransactionItem = {
  price: { id: string; unit_price?: { amount: string } } | null;
  quantity: number;
};

/** A refused card or change, said so a customer can act on it. */
function declinedAsMessage(error: unknown): unknown {
  if (
    error instanceof PaddleApiError &&
    /declin|authenticat|payment/i.test(`${error.code ?? ""} ${error.message}`)
  ) {
    return new Error(
      "Your card was declined or needs extra verification, so the plan was not changed. Change your card and try again.",
    );
  }
  return error;
}

/** Thrown when an event cannot be applied yet; Paddle retries it later. */
export class PaddleEventError extends Error {}

/**
 * The currency of a charge on a subscription. Every Paddle price we sell is
 * in US dollars, so anything else is refused (and logged) rather than
 * recorded with amounts in the wrong unit.
 */
function chargeCurrency(txn: PaddleTransaction): PaymentCurrency {
  if (txn.currency_code !== "USD") {
    throw new Error(
      `Paddle transaction ${txn.id} is in ${txn.currency_code ?? "no currency"}; only USD is billed through Paddle`,
    );
  }
  return "USD";
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function dateOrNull(value: unknown): Date | null {
  const raw = str(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function subscriptionStatus(raw: string): PaddleSubscriptionStatus {
  return (PADDLE_SUBSCRIPTION_STATUSES as readonly string[]).includes(raw)
    ? (raw as PaddleSubscriptionStatus)
    : "active";
}

/** The subscription items a checkout bought, for renewals to grant again. */
export function subscriptionItemsOf(
  payment: Pick<PaymentRecord, "items">,
): PaddleSubscriptionItem[] {
  return payment.items.flatMap((item) =>
    item.kind === "subscription" &&
    item.productId &&
    item.providerPriceId &&
    item.durationDays
      ? [
          {
            productId: item.productId,
            variantId: item.variantId,
            applyVariant: item.applyVariant ?? "auto",
            priceId: item.providerPriceId,
            name: item.name,
            durationDays: item.durationDays,
          },
        ]
      : [],
  );
}

/** Tell a user their renewal could not be charged. */
async function notifyPaymentFailed(
  userId: string,
  names: string[],
): Promise<void> {
  const what = names.length > 0 ? names.join(", ") : "your subscription";
  const title = "We could not charge your card";
  const body = `The renewal of ${what} was declined. Update your card before it expires or the service will be turned off. We will keep retrying for a few days.`;
  const link = "/billing";
  await notificationService.send(
    { userId, title, body, link, channels: "both" },
    {
      customEmail: (to) =>
        mailer.sendNotification(to, {
          title,
          body,
          url: absoluteLink(env.appBaseUrl, link),
          buttonLabel: "Update card",
        }),
    },
  );
}

/**
 * The Paddle side that is not a single payment: webhooks (payments
 * confirmed, renewals charged, subscriptions changed, refunds), the
 * user's renewing subscriptions: changing plan or card and stopping renewal.
 */
export class PaddleService {
  constructor(
    private readonly client: PaddleClient | null,
    private readonly store: PaymentStore = mongoPaymentStore,
    /** Where invoices are recorded and granted. */
    private readonly payments: Pick<
      PaymentService,
      "applyProviderStatus" | "recordCharge" | "recordRenewal"
    > = paymentService,
  ) {}

  /** Apply one verified webhook. Throws to have Paddle retry it later. */
  async handle(event: PaddleEvent): Promise<void> {
    const data = event.data ?? {};
    switch (event.event_type) {
      case "transaction.completed":
      case "transaction.canceled":
        return this.onTransaction(data as unknown as PaddleTransaction);
      case "subscription.created":
      case "subscription.updated":
      case "subscription.activated":
      case "subscription.canceled":
      case "subscription.past_due":
      case "subscription.paused":
      case "subscription.resumed":
      case "subscription.trialing":
        return this.onSubscription(data as unknown as PaddleSubscriptionData);
      case "adjustment.created":
      case "adjustment.updated":
        return this.onAdjustment(data);
      default:
        // Subscribed to more than we use: nothing to do.
        return;
    }
  }

  private async onTransaction(txn: PaddleTransaction): Promise<void> {
    const paymentId = str(txn.custom_data?.paymentId);
    const payment = paymentId ? await this.store.get(paymentId) : null;
    const isCheckout =
      payment !== null &&
      payment.provider === "paddle" &&
      (payment.reference === null || payment.reference === txn.id);

    if (isCheckout) {
      await this.onCheckoutTransaction(payment, txn);
      return;
    }
    if (txn.subscription_id && txn.status === "completed") {
      // A change or one-off charge on a subscription is not a renewal: it
      // grants no new period (a variant change is applied when it is made).
      if (
        txn.origin === "subscription_update" ||
        txn.origin === "subscription_charge"
      ) {
        if (txn.origin === "subscription_update") {
          await this.onPlanChangeCharge(txn);
        }
        return;
      }
      await this.onRenewal(txn, payment);
      return;
    }
    if (txn.subscription_id) {
      // A charge on a subscription that did not go through (a declined
      // upgrade, say): nothing was bought, so there is nothing to record.
      logger.info(
        `Paddle transaction ${txn.id} (${txn.status}, ${txn.origin}) of ${txn.subscription_id} needs no invoice`,
        logSource,
        "onTransaction",
      );
      return;
    }
    logger.warn(
      `Paddle transaction ${txn.id} matches no invoice`,
      logSource,
      "onTransaction",
    );
  }

  /** The transaction a checkout made: confirm or cancel its invoice. */
  private async onCheckoutTransaction(
    payment: PaymentRecord,
    txn: PaddleTransaction,
  ): Promise<void> {
    if (payment.reference === null) {
      await this.store.update(payment.id, { reference: txn.id });
    }
    // Only our own prices can be on it: anything else is looked at by hand.
    const billed = txn.items.map((item) => item.price?.id ?? item.price_id);
    const ours = new Set(payment.items.map((item) => item.providerPriceId));
    if (billed.some((id) => !id || !ours.has(id))) {
      await this.store.update(payment.id, {
        needsReview: true,
        reviewNote: `Paddle transaction ${txn.id} bills prices that are not on this invoice`,
      });
      logger.error(
        `Price mismatch on ${payment.invoiceNumber}`,
        logSource,
        "onCheckoutTransaction",
      );
      return;
    }
    await this.payments.applyProviderStatus(
      payment.id,
      paddleStatus(txn),
      "notification",
    );
    if (txn.subscription_id && txn.customer_id && txn.status === "completed") {
      await this.store.update(payment.id, {
        subscriptionRef: txn.subscription_id,
      });
      await this.ensureSubscription(
        txn.subscription_id,
        txn.customer_id,
        payment,
      );
    }
  }

  /** The charge for a plan change: an invoice, but no new period. */
  private async onPlanChangeCharge(txn: PaddleTransaction): Promise<void> {
    const subscription = await PaddleSubscriptionModel.findOne({
      subscriptionId: txn.subscription_id!,
    })
      .lean()
      .exec();
    if (!subscription) {
      throw new PaddleEventError(
        `Plan change ${txn.id} of unknown subscription ${txn.subscription_id}`,
      );
    }
    const amount = Number(txn.details?.totals?.subtotal ?? 0);
    // A downgrade is credited, not charged: nothing to invoice.
    if (!Number.isFinite(amount) || amount <= 0) return;

    // What it was for: the plan the customer moved to, by its Paddle price.
    const priceId = txn.items[0]?.price?.id ?? txn.items[0]?.price_id ?? null;
    const product = priceId
      ? await ProductModel.findOne({
          $or: [
            { paddlePriceId: priceId },
            { "variants.paddlePriceId": priceId },
          ],
        })
          .lean()
          .exec()
      : null;
    const variant = product
      ? (variantsOf(product).find((v) => v.paddlePriceId === priceId) ?? null)
      : null;
    await this.payments.recordCharge({
      userId: subscription.userId.toString(),
      subscriptionRef: subscription.subscriptionId,
      reference: txn.id,
      currency: chargeCurrency(txn),
      paymentType: paddleStatus(txn).paymentType,
      name: product
        ? `Plan change: ${lineName(product, variant)}`
        : "Plan change",
      description: "Difference for the rest of the current period",
      amount,
    });
  }

  /** A renewal Paddle charged by itself: one more period of each item. */
  private async onRenewal(
    txn: PaddleTransaction,
    firstPayment: PaymentRecord | null,
  ): Promise<void> {
    const subscriptionId = txn.subscription_id!;
    let subscription: PaddleSubscriptionInterface | null =
      await PaddleSubscriptionModel.findOne({
        subscriptionId,
      })
        .lean()
        .exec();
    if (!subscription && firstPayment && txn.customer_id) {
      subscription = await this.ensureSubscription(
        subscriptionId,
        txn.customer_id,
        firstPayment,
      );
    }
    if (!subscription) {
      throw new PaddleEventError(
        `Renewal ${txn.id} of unknown subscription ${subscriptionId}`,
      );
    }

    const items = (txn.items as TransactionItem[]).flatMap((item) => {
      const priceId = item.price?.id;
      const bought = subscription.items.find((i) => i.priceId === priceId);
      if (!bought || !priceId) return [];
      return [
        {
          productId: bought.productId.toString(),
          variantId: bought.variantId,
          applyVariant: bought.applyVariant,
          name: bought.name,
          durationDays: bought.durationDays,
          providerPriceId: priceId,
          unitPrice: Number(item.price?.unit_price?.amount ?? 0),
          quantity: item.quantity,
        },
      ];
    });
    if (items.length === 0) {
      throw new PaddleEventError(
        `Renewal ${txn.id} bills no price of subscription ${subscriptionId}`,
      );
    }
    // The renewal bills the plan a scheduled change moved to: it has started.
    if (subscription.pendingChange) {
      await PaddleSubscriptionModel.updateOne(
        { subscriptionId },
        { $set: { pendingChange: null } },
      ).exec();
    }
    await this.payments.recordRenewal({
      userId: subscription.userId.toString(),
      subscriptionRef: subscriptionId,
      reference: txn.id,
      currency: chargeCurrency(txn),
      paymentType: paddleStatus(txn).paymentType,
      items,
    });
  }

  /** The subscription's record, made from the checkout that started it. */
  private async ensureSubscription(
    subscriptionId: string,
    customerId: string,
    firstPayment: PaymentRecord,
  ): Promise<PaddleSubscriptionInterface> {
    const items = subscriptionItemsOf(firstPayment);
    const doc = await PaddleSubscriptionModel.findOneAndUpdate(
      { subscriptionId },
      {
        $setOnInsert: {
          userId: firstPayment.userId,
          subscriptionId,
          status: "active",
          nextBilledAt: null,
          cancelsAt: null,
          // Only when it is first made: a webhook delivered again later must
          // not put back the plan a customer has since moved to.
          items,
          firstPaymentId: new Types.ObjectId(firstPayment.id),
        },
        $set: { customerId },
      },
      { upsert: true, returnDocument: "after" },
    )
      .lean()
      .exec();
    return doc!;
  }

  private async onSubscription(data: PaddleSubscriptionData): Promise<void> {
    const status = subscriptionStatus(data.status);
    const cancelsAt =
      status === "canceled"
        ? (dateOrNull(data.canceled_at) ?? new Date())
        : data.scheduled_change?.action === "cancel"
          ? dateOrNull(data.scheduled_change.effective_at)
          : null;
    const fields = {
      status,
      customerId: data.customer_id,
      nextBilledAt:
        status === "canceled" ? null : dateOrNull(data.next_billed_at),
      cancelsAt,
    };

    const before = await PaddleSubscriptionModel.findOneAndUpdate(
      { subscriptionId: data.id },
      { $set: fields },
      { returnDocument: "before" },
    )
      .lean()
      .exec();
    if (before) {
      // Tell the user once, when the subscription first falls behind.
      if (status === "past_due" && before.status !== "past_due") {
        try {
          await notifyPaymentFailed(
            before.userId.toString(),
            before.items.map((item) => item.name),
          );
        } catch (error) {
          logger.error(
            `Payment-failed notice for ${data.id} failed: ${error instanceof Error ? error.message : String(error)}`,
            logSource,
            "onSubscription",
          );
        }
      }
      return;
    }

    // Before its first payment was confirmed: make it from that checkout.
    const paymentId = str(data.custom_data?.paymentId);
    const payment = paymentId ? await this.store.get(paymentId) : null;
    if (!payment) {
      logger.warn(
        `Paddle subscription ${data.id} matches no invoice`,
        logSource,
        "onSubscription",
      );
      return;
    }
    await this.ensureSubscription(data.id, data.customer_id, payment);
    await PaddleSubscriptionModel.updateOne(
      { subscriptionId: data.id },
      { $set: fields },
    ).exec();
  }

  /** A refund or chargeback Paddle approved: flag the invoice. */
  private async onAdjustment(data: Record<string, unknown>): Promise<void> {
    const action = str(data.action);
    const transactionId = str(data.transaction_id);
    if (
      !transactionId ||
      str(data.status) !== "approved" ||
      !action ||
      !["refund", "chargeback"].includes(action)
    ) {
      return;
    }
    const payment = await this.store.findByReference("paddle", transactionId);
    if (!payment) return;
    await this.payments.applyProviderStatus(
      payment.id,
      {
        state: "refunded",
        raw: action,
        amount: null,
        reference: transactionId,
        paymentType: null,
      },
      "notification",
    );
    // A chargeback takes the access back and stops the renewals; a refund is
    // looked at by hand.
    if (action === "chargeback") {
      await this.revokeAccessOf(payment.id);
      await this.cancelSubscriptionOf(payment);
    }
  }

  /** End the Paddle subscription a charged-back payment belongs to, at once. */
  private async cancelSubscriptionOf(payment: PaymentRecord): Promise<void> {
    if (!this.client) return;
    const mirror = payment.subscriptionRef
      ? null
      : await PaddleSubscriptionModel.findOne({
          firstPaymentId: new Types.ObjectId(payment.id),
        })
          .lean()
          .exec();
    const subscriptionId = payment.subscriptionRef ?? mirror?.subscriptionId;
    if (!subscriptionId) return;
    try {
      await this.client.cancelSubscription(subscriptionId, "immediately");
      logger.warn(
        `Subscription ${subscriptionId} cancelled after a chargeback on ${payment.invoiceNumber}`,
        logSource,
        "cancelSubscriptionOf",
      );
    } catch (error) {
      // Already ended (Paddle may cancel it itself): nothing more to do.
      // Anything else is retried, because Paddle sends the event again.
      if (
        error instanceof PaddleApiError &&
        error.status < 500 &&
        error.status !== 429
      ) {
        logger.warn(
          `Could not cancel ${subscriptionId} after a chargeback: ${error.message}`,
          logSource,
          "cancelSubscriptionOf",
        );
        return;
      }
      throw error;
    }
  }

  /**
   * Take back what a payment granted: periods that have not started are
   * removed, the running one ends now, one-time purchases are removed.
   * Periods already over stay as history. Safe to run twice.
   */
  async revokeAccessOf(
    paymentId: string,
    now: Date = new Date(),
  ): Promise<void> {
    const id = new Types.ObjectId(paymentId);
    const removed = await UserProductPeriodModel.deleteMany({
      paymentId: id,
      startsAt: { $gte: now },
    }).exec();
    const ended = await UserProductPeriodModel.updateMany(
      {
        paymentId: id,
        startsAt: { $lt: now },
        $or: [{ endsAt: null }, { endsAt: { $gt: now } }],
      },
      { $set: { endsAt: now } },
    ).exec();
    const purchases = await PurchaseModel.deleteMany({ paymentId: id }).exec();
    logger.warn(
      `Chargeback on payment ${paymentId}: removed ${removed.deletedCount} periods, ended ${ended.modifiedCount}, removed ${purchases.deletedCount} purchases`,
      logSource,
      "revokeAccessOf",
    );
  }

  /** The user's subscriptions Paddle renews or renewed, newest first. */
  async listFor(userId: string): Promise<PaddleSubscriptionOutDto[]> {
    const docs = await PaddleSubscriptionModel.find({ userId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    const covers = new Map(
      (
        await ProductModel.find({
          _id: {
            $in: docs.flatMap((doc) => doc.items.map((i) => i.productId)),
          },
        })
          .select("images")
          .lean()
          .exec()
      ).map((p) => [p._id.toString(), publicFileUrl(p.images?.[0] ?? null)]),
    );
    return docs.map((doc) => ({
      id: doc.subscriptionId,
      status: doc.status,
      products: doc.items.map((item) => ({
        productId: item.productId.toString(),
        name: item.name,
        imageUrl: covers.get(item.productId.toString()) ?? null,
      })),
      nextBilledAt: doc.nextBilledAt?.toISOString() ?? null,
      cancelsAt: doc.cancelsAt?.toISOString() ?? null,
      pendingChange: doc.pendingChange
        ? {
            name: doc.pendingChange.toName,
            effectiveAt: doc.pendingChange.effectiveAt?.toISOString() ?? null,
          }
        : null,
    }));
  }

  /** The user's own subscription that is still renewing; throws otherwise. */
  private async ownRenewing(
    userId: string,
    subscriptionId: string,
  ): Promise<PaddleSubscriptionInterface> {
    if (!this.client) throw new Error("Paddle is not set up");
    const doc = await PaddleSubscriptionModel.findOne({
      userId,
      subscriptionId,
    })
      .lean()
      .exec();
    if (!doc) throw new Error("Subscription not found");
    if (!(RENEWING_STATUSES as readonly string[]).includes(doc.status)) {
      throw new Error("This subscription is no longer renewing");
    }
    return doc;
  }

  /**
   * Stop renewing after the period the user has paid for; what they have
   * keeps running until then.
   */
  async cancelRenewal(userId: string, subscriptionId: string): Promise<void> {
    const doc = await this.ownRenewing(userId, subscriptionId);
    if (doc.cancelsAt) return;
    const result = await this.client!.cancelSubscription(subscriptionId);
    await PaddleSubscriptionModel.updateOne(
      { subscriptionId },
      {
        $set: {
          cancelsAt:
            dateOrNull(result.scheduled_change?.effective_at) ??
            doc.nextBilledAt,
        },
      },
    ).exec();
  }

  /** Take back a cancellation that has not taken effect yet. */
  async resumeRenewal(userId: string, subscriptionId: string): Promise<void> {
    const doc = await this.ownRenewing(userId, subscriptionId);
    if (!doc.cancelsAt) return;
    await this.client!.resumeSubscription(subscriptionId);
    await PaddleSubscriptionModel.updateOne(
      { subscriptionId },
      { $set: { cancelsAt: null } },
    ).exec();
  }

  /** The one product line a subscription can change variants on, with its product. */
  private async upgradeContext(
    userId: string,
    subscriptionId: string,
    allowPending = false,
  ) {
    const doc = await this.ownRenewing(userId, subscriptionId);
    if (doc.pendingChange && !allowPending) {
      throw new Error(
        `A change to ${doc.pendingChange.toName} is already scheduled: cancel it first`,
      );
    }
    if (doc.status === "past_due") {
      throw new Error("Update your card first: the last renewal was declined");
    }
    if (doc.cancelsAt) {
      throw new Error("Keep renewing first: this subscription is set to end");
    }
    if (doc.items.length !== 1) {
      throw new Error(
        "Subscriptions with several products cannot be changed here",
      );
    }
    const line = doc.items[0];
    const product = await ProductModel.findById(line.productId).lean().exec();
    if (!product || product.deletedAt) {
      throw new Error("This product is no longer available");
    }
    return { doc, line, product };
  }

  /** The variants the user can move this subscription to. */
  async upgradeChoices(
    userId: string,
    subscriptionId: string,
  ): Promise<UpgradeChoiceOutDto[]> {
    const { line, product } = await this.upgradeContext(userId, subscriptionId);
    return upgradeOptions(product, line).map((variant) => ({
      variantId: variant.id,
      name: variant.name,
      priceCents: variant.priceUsdCents ?? 0,
    }));
  }

  private async targetOf(
    userId: string,
    subscriptionId: string,
    variantId: string,
  ) {
    const context = await this.upgradeContext(userId, subscriptionId);
    const target = upgradeOptions(context.product, context.line).find(
      (variant) => variant.id === variantId,
    );
    if (!target || !target.paddlePriceId) {
      throw new Error("That variant is not available");
    }
    const items = itemsAfterSwitch(
      context.doc.items.map((item) => item.priceId),
      context.line.priceId,
      target.paddlePriceId,
    );
    // A cheaper (or equal) plan starts at the next renewal, not now.
    const current = variantOf(context.product, context.line.variantId);
    const scheduled =
      (target.priceUsdCents ?? 0) <= (current?.priceUsdCents ?? 0);
    return { ...context, target, items, scheduled };
  }

  /** What moving to this variant would cost now, before the user agrees. */
  async previewUpgrade(
    userId: string,
    subscriptionId: string,
    variantId: string,
  ): Promise<UpgradePreviewOutDto> {
    const { doc, items, target, scheduled } = await this.targetOf(
      userId,
      subscriptionId,
      variantId,
    );
    if (scheduled) {
      return {
        variantId: target.id,
        name: target.name,
        currency: "USD",
        amountCents: 0,
        credit: false,
        scheduled: true,
        nextBilledAt: doc.nextBilledAt?.toISOString() ?? null,
        renewalCents: target.priceUsdCents ?? 0,
      };
    }
    let preview;
    try {
      preview = await this.client!.previewPriceChange(subscriptionId, items);
    } catch (error) {
      throw declinedAsMessage(error);
    }
    const result = preview.update_summary?.result;
    const totals = preview.immediate_transaction?.details?.totals;
    const amount = Number(
      result?.amount ?? totals?.grand_total ?? totals?.total ?? 0,
    );
    const currency = result?.currency_code ?? totals?.currency_code ?? "USD";
    return {
      variantId: target.id,
      name: target.name,
      currency,
      amountCents: Number.isFinite(amount) ? Math.abs(amount) : 0,
      // "credit": the user is owed money; otherwise they pay now.
      credit: result?.action === "credit",
      scheduled: false,
      nextBilledAt: dateOrNull(preview.next_billed_at)?.toISOString() ?? null,
      renewalCents: target.priceUsdCents ?? 0,
    };
  }

  /**
   * Move the subscription to another variant now. Paddle charges the
   * difference for the rest of the period and keeps the billing date; if the
   * payment fails, nothing changes. Then the running and scheduled periods
   * of the product are put on the new variant.
   */
  async upgrade(
    userId: string,
    subscriptionId: string,
    variantId: string,
  ): Promise<void> {
    const { doc, line, product, target, items, scheduled } =
      await this.targetOf(userId, subscriptionId, variantId);
    try {
      await this.client!.changePrice(
        subscriptionId,
        items,
        scheduled ? "full_next_billing_period" : "prorated_immediately",
      );
    } catch (error) {
      throw declinedAsMessage(error);
    }

    if (scheduled) {
      // Paddle bills the new price from the next renewal; the customer keeps
      // the plan they paid for until then, so their periods stay as they are.
      await PaddleSubscriptionModel.updateOne(
        { subscriptionId, "items.priceId": line.priceId },
        {
          $set: {
            "items.$.priceId": target.paddlePriceId,
            "items.$.variantId": target.id,
            "items.$.name": lineName(product, target),
            pendingChange: {
              fromPriceId: line.priceId,
              fromVariantId: line.variantId,
              fromName: line.name,
              toName: lineName(product, target),
              effectiveAt: doc.nextBilledAt,
            },
          },
        },
      ).exec();
      return;
    }

    await PaddleSubscriptionModel.updateOne(
      { subscriptionId, "items.priceId": line.priceId },
      {
        $set: {
          "items.$.priceId": target.paddlePriceId,
          "items.$.variantId": target.id,
          "items.$.name": lineName(product, target),
        },
      },
    ).exec();
    const now = new Date();
    await UserProductPeriodModel.updateMany(
      {
        userId: doc.userId,
        productId: line.productId,
        $or: [{ endsAt: null }, { endsAt: { $gt: now } }],
      },
      { $set: { variantId: target.id, applyVariant: line.applyVariant } },
    ).exec();
  }

  /** Take back a scheduled move to a cheaper plan before it starts. */
  async cancelScheduledChange(
    userId: string,
    subscriptionId: string,
  ): Promise<void> {
    const { doc, line } = await this.upgradeContext(
      userId,
      subscriptionId,
      true,
    );
    const pending = doc.pendingChange;
    if (!pending) return;
    try {
      await this.client!.changePrice(
        subscriptionId,
        itemsAfterSwitch(
          doc.items.map((item) => item.priceId),
          line.priceId,
          pending.fromPriceId,
        ),
        "full_next_billing_period",
      );
    } catch (error) {
      throw declinedAsMessage(error);
    }
    await PaddleSubscriptionModel.updateOne(
      { subscriptionId, "items.priceId": line.priceId },
      {
        $set: {
          "items.$.priceId": pending.fromPriceId,
          "items.$.variantId": pending.fromVariantId,
          "items.$.name": pending.fromName,
          pendingChange: null,
        },
      },
    ).exec();
  }

  /** The Paddle transaction to open in checkout to change the card. */
  async cardTransactionId(
    userId: string,
    subscriptionId: string,
  ): Promise<string> {
    await this.ownRenewing(userId, subscriptionId);
    const txn =
      await this.client!.updatePaymentMethodTransaction(subscriptionId);
    return txn.id;
  }
}

export const paddleService = new PaddleService(paddleClient);
