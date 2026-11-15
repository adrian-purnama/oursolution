import { Types } from "mongoose";
import { logger } from "../../logger/logger";
import { nextSequence } from "../../models/counter/counter.model";
import { PaymentModel } from "../../models/payment/payment.model";
import { ProductModel } from "../../models/product/product.model";
import { formatInvoiceNumber } from "./checkout.rules";
import { notifyPaymentReceived } from "./payment.invoice";
import { paymentService, setAfterGrant } from "./payment.service";

const logSource = "modules/payment/payment.scheduler.ts";
const SWEEP_INTERVAL_MS = 60_000;
const SWEEP_BATCH = 25;

/**
 * Pending payments are confirmed by Midtrans' notification when it can reach
 * this server, and otherwise by asking Midtrans every minute. The same sweep
 * expires unpaid invoices and finishes interrupted grants.
 */
export function startPaymentSweep(): void {
  setAfterGrant(notifyPaymentReceived);

  let running = false;
  const sweep = async () => {
    if (running) return;
    running = true;
    try {
      const due = await PaymentModel.find({
        $or: [
          {
            status: "pending",
            $or: [
              { checkedAt: null },
              { checkedAt: { $lte: new Date(Date.now() - SWEEP_INTERVAL_MS) } },
            ],
          },
          { status: "paid", grantedAt: null },
        ],
      })
        .sort({ checkedAt: 1 })
        .limit(SWEEP_BATCH)
        .select("_id")
        .lean()
        .exec();
      for (const { _id } of due) {
        try {
          await paymentService.refresh(_id.toString());
        } catch (error) {
          logger.error(
            `Payment sweep failed for ${_id.toString()}: ${error instanceof Error ? error.message : String(error)}`,
            logSource,
            "sweep",
          );
        }
      }
    } catch (error) {
      logger.error(
        error instanceof Error ? error.message : String(error),
        logSource,
        "sweep",
      );
    } finally {
      running = false;
    }
  };

  setInterval(() => void sweep(), SWEEP_INTERVAL_MS).unref();
  void sweep();
}

type LegacyPayment = {
  _id: Types.ObjectId;
  productId?: Types.ObjectId;
  amountIdr?: number;
  durationDays?: number | null;
  periodId?: Types.ObjectId | null;
  purchaseId?: Types.ObjectId | null;
  status?: string;
  createdAt?: Date;
};

/**
 * Payments made before invoices held one product each. Give them an item
 * list, an invoice number and an expiry so they read like the rest.
 */
export async function migrateLegacyPayments(): Promise<void> {
  const legacy = await PaymentModel.collection
    .find<LegacyPayment>({ items: { $exists: false } })
    .toArray();
  if (legacy.length === 0) return;

  for (const doc of legacy) {
    const product = doc.productId
      ? await ProductModel.findById(doc.productId).lean().exec()
      : null;
    const createdAt = doc.createdAt ?? doc._id.getTimestamp();
    const year = createdAt.getUTCFullYear();
    const amount = doc.amountIdr ?? 0;
    await PaymentModel.collection.updateOne(
      { _id: doc._id, items: { $exists: false } },
      {
        $set: {
          invoiceNumber: formatInvoiceNumber(
            year,
            await nextSequence(`invoice-${year}`),
          ),
          items: [
            {
              productId: doc.productId,
              name: product?.name ?? "Deleted product",
              kind:
                product?.kind ??
                (doc.durationDays ? "subscription" : "oneTime"),
              unitPriceIdr: amount,
              quantity: 1,
              durationDays: doc.durationDays ?? null,
              amountIdr: amount,
              periodIds: doc.periodId ? [doc.periodId] : [],
              purchaseId: doc.purchaseId ?? null,
            },
          ],
          expiresAt: createdAt,
          paidAt: doc.status === "paid" ? createdAt : null,
          grantedAt: doc.status === "paid" ? createdAt : null,
          grantClaimedAt: null,
          checkedAt: null,
          redirectUrl: null,
          snapToken: null,
          paymentType: null,
          providerStatus: null,
          needsReview: false,
          reviewNote: null,
        },
        $unset: {
          productId: "",
          durationDays: "",
          periodId: "",
          purchaseId: "",
        },
      },
    );
  }
  logger.info(
    `Gave ${legacy.length} older payment(s) an invoice`,
    logSource,
    "migrateLegacyPayments",
  );
}
