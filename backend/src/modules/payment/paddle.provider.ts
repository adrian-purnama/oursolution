import { createHmac, timingSafeEqual } from "node:crypto";
import { logger } from "../../logger/logger";
import {
  PaddleApiError,
  PaddleClient,
  type PaddleTransaction,
} from "./paddle.client";
import type {
  ChargeRequest,
  ChargeResult,
  PaymentProvider,
  ProviderStatus,
} from "./payment.provider";

const logSource = "modules/payment/paddle.provider.ts";

/** A webhook older than this is refused, so a captured one cannot be replayed. */
const SIGNATURE_TOLERANCE_S = 5 * 60;

/** Paddle's transaction status, in our terms. Pure; exported for tests. */
export function paddleStatus(txn: PaddleTransaction): ProviderStatus {
  let state: ProviderStatus["state"];
  switch (txn.status) {
    // "paid" is captured but still being processed: grant on "completed".
    case "completed":
      state = "paid";
      break;
    case "canceled":
      state = "cancelled";
      break;
    default:
      // draft, ready, billed, paid, past_due
      state = "pending";
  }
  const subtotal = txn.details?.totals?.subtotal;
  const amount = subtotal === undefined ? null : Number(subtotal);
  return {
    state,
    raw: txn.status,
    // Prices are tax-exclusive, so the subtotal is what we billed.
    amountIdr: amount !== null && Number.isFinite(amount) ? amount : null,
    reference: txn.id,
    paymentType: txn.payments?.[0]?.method_details?.type ?? null,
  };
}

/**
 * True when `header` (Paddle-Signature: "ts=...;h1=...") signs `rawBody`
 * with `secret` and is recent. Several h1 values may be sent while a secret
 * is rotated; any match passes. Pure; exported for tests.
 */
export function verifyPaddleSignature(
  rawBody: Buffer | string,
  header: string | undefined,
  secret: string,
  nowS: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!header) return false;
  let ts: string | null = null;
  const hashes: string[] = [];
  for (const part of header.split(";")) {
    const [key, value] = part.split("=", 2);
    if (key === "ts" && value) ts = value;
    if (key === "h1" && value) hashes.push(value);
  }
  if (!ts || hashes.length === 0 || !/^\d+$/.test(ts)) return false;
  if (Math.abs(nowS - Number(ts)) > SIGNATURE_TOLERANCE_S) return false;

  const expected = Buffer.from(
    createHmac("sha256", secret)
      .update(`${ts}:`)
      .update(rawBody)
      .digest("hex"),
    "utf8",
  );
  return hashes.some((hash) => {
    const given = Buffer.from(hash, "utf8");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/**
 * Paddle Checkout for customers outside Indonesia. A checkout becomes a
 * Paddle transaction holding our Paddle prices; the browser opens it with
 * Paddle.js. Subscription prices make Paddle start a subscription that it
 * renews by itself (see paddle.service.ts).
 */
export class PaddleProvider implements PaymentProvider {
  readonly name = "paddle";

  constructor(readonly client: PaddleClient) {}

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    if (request.currency !== "USD") {
      return { status: "failed", reason: "Paddle bills in US dollars only" };
    }
    const missing = request.lines.find((line) => !line.providerPriceId);
    if (missing) {
      return {
        status: "failed",
        reason: `${missing.name} has no Paddle price yet`,
      };
    }

    let txn: PaddleTransaction;
    try {
      const customerId = await this.client.customerIdFor(request.customerEmail);
      txn = await this.client.request<PaddleTransaction>(
        "POST",
        "/transactions",
        {
          customer_id: customerId,
          currency_code: "USD",
          collection_mode: "automatic",
          items: request.lines.map((line) => ({
            price_id: line.providerPriceId,
            quantity: line.quantity,
          })),
          custom_data: {
            paymentId: request.paymentId,
            userId: request.userId,
            invoiceNumber: request.invoiceNumber,
          },
        },
      );
    } catch (error) {
      logger.error(
        `Paddle transaction for ${request.invoiceNumber} failed: ${error instanceof Error ? error.message : String(error)}`,
        logSource,
        "charge",
      );
      return {
        status: "failed",
        reason:
          error instanceof PaddleApiError &&
          error.code === "transaction_default_checkout_url_not_set"
            ? "Paddle checkout is not set up: set a default payment link in Paddle's checkout settings"
            : "The payment provider could not start the payment",
      };
    }

    return {
      status: "pending",
      reference: txn.id,
      // Opened inside our page with Paddle.js; the hosted link is a fallback.
      redirectUrl: txn.checkout?.url ?? request.finishUrl,
      token: txn.id,
    };
  }

  async fetchStatus(
    _paymentId: string,
    reference: string | null,
  ): Promise<ProviderStatus | null> {
    if (!reference) return null;
    try {
      return paddleStatus(await this.client.getTransaction(reference));
    } catch (error) {
      if (error instanceof PaddleApiError && error.status === 404) return null;
      throw error;
    }
  }

  /** Cancel a transaction that has not been paid, so it cannot be. */
  async expire(_paymentId: string, reference: string | null): Promise<void> {
    if (!reference) return;
    try {
      await this.client.request(
        "PATCH",
        `/transactions/${encodeURIComponent(reference)}`,
        { status: "canceled" },
      );
    } catch (error) {
      // Already paid, completed or canceled: nothing to close.
      if (error instanceof PaddleApiError && error.status < 500) return;
      throw error;
    }
  }
}
