import { Types } from "mongoose";
import type { PaddleSubscriptionOutDto } from "../../dto/payment.dto";
import { logger } from "../../logger/logger";
import type {
  PaddleSubscriptionInterface,
  PaddleSubscriptionItem,
  PaddleSubscriptionStatus,
} from "../../models/paddleSubscription/paddleSubscription.interface";
import { PADDLE_SUBSCRIPTION_STATUSES } from "../../models/paddleSubscription/paddleSubscription.interface";
import { PaddleSubscriptionModel } from "../../models/paddleSubscription/paddleSubscription.model";
import { UserModel } from "../../models/user/user.model";
import type { PaddleClient, PaddleTransaction } from "./paddle.client";
import { paddleClient } from "./paddle.client";
import { paddleStatus } from "./paddle.provider";
import {
  mongoPaymentStore,
  paymentService,
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

/** Thrown when an event cannot be applied yet; Paddle retries it later. */
export class PaddleEventError extends Error {}

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

/**
 * The Paddle side that is not a single payment: webhooks (payments
 * confirmed, renewals charged, subscriptions changed, refunds), the
 * user's renewing subscriptions and Paddle's customer portal.
 */
export class PaddleService {
  constructor(
    private readonly client: PaddleClient | null,
    private readonly store: PaymentStore = mongoPaymentStore,
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
      await this.onRenewal(txn, payment);
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
    await paymentService.applyProviderStatus(
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
    await paymentService.recordRenewal({
      userId: subscription.userId.toString(),
      subscriptionRef: subscriptionId,
      reference: txn.id,
      currency: txn.currency_code === "USD" ? "USD" : "IDR",
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
        },
        $set: {
          customerId,
          items,
          firstPaymentId: new Types.ObjectId(firstPayment.id),
        },
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
      nextBilledAt: status === "canceled" ? null : dateOrNull(data.next_billed_at),
      cancelsAt,
    };

    const updated = await PaddleSubscriptionModel.updateOne(
      { subscriptionId: data.id },
      { $set: fields },
    ).exec();
    if (updated.matchedCount > 0) return;

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
    await paymentService.applyProviderStatus(
      payment.id,
      {
        state: "refunded",
        raw: action,
        amountIdr: null,
        reference: transactionId,
        paymentType: null,
      },
      "notification",
    );
  }

  /** The user's subscriptions Paddle renews or renewed, newest first. */
  async listFor(userId: string): Promise<PaddleSubscriptionOutDto[]> {
    const docs = await PaddleSubscriptionModel.find({ userId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return docs.map((doc) => ({
      id: doc.subscriptionId,
      status: doc.status,
      products: doc.items.map((item) => ({
        productId: item.productId.toString(),
        name: item.name,
      })),
      nextBilledAt: doc.nextBilledAt?.toISOString() ?? null,
      cancelsAt: doc.cancelsAt?.toISOString() ?? null,
    }));
  }

  /**
   * A link to Paddle's customer portal, where the user cancels renewal or
   * changes their card. Throws when the user has never paid with Paddle.
   */
  async portalUrl(userId: string): Promise<string> {
    if (!this.client) throw new Error("Paddle is not set up");
    const subscriptions = await PaddleSubscriptionModel.find({ userId })
      .lean()
      .exec();
    let customerId = subscriptions[0]?.customerId ?? null;
    if (!customerId) {
      const user = await UserModel.findById(userId).select("email").lean();
      if (!user) throw new Error("User not found");
      customerId = await this.client.customerIdFor(user.email);
    }
    return this.client.portalUrl(
      customerId,
      subscriptions
        .filter((s) =>
          (RENEWING_STATUSES as readonly string[]).includes(s.status),
        )
        .map((s) => s.subscriptionId),
    );
  }
}

export const paddleService = new PaddleService(paddleClient);
