import { createHash, timingSafeEqual } from "node:crypto";
import { logger } from "../../logger/logger";
import type {
  ChargeRequest,
  ChargeResult,
  PaymentProvider,
  ProviderStatus,
} from "./payment.provider";

const logSource = "modules/payment/midtrans.provider.ts";
const REQUEST_TIMEOUT_MS = 15_000;

/** What Midtrans posts to the notification URL (the fields we read). */
export interface MidtransNotification {
  order_id?: unknown;
  status_code?: unknown;
  gross_amount?: unknown;
  signature_key?: unknown;
  transaction_status?: unknown;
  fraud_status?: unknown;
  payment_type?: unknown;
  transaction_id?: unknown;
}

export type MidtransConfig = {
  serverKey: string;
  sandbox: boolean;
  /** Sent as X-Override-Notification, when set. */
  notificationUrl: string | null;
};

type FetchLike = typeof fetch;

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Midtrans' transaction status, in our terms. Pure; exported for tests. */
export function midtransStatus(n: MidtransNotification): ProviderStatus {
  const raw = str(n.transaction_status) ?? "";
  const fraud = str(n.fraud_status);
  const gross = str(n.gross_amount);
  const amount = gross === null ? null : Number(gross);

  let state: ProviderStatus["state"];
  switch (raw) {
    case "settlement":
      state = "paid";
      break;
    case "capture":
      // Card payments: only "accept" means the money is in.
      state = fraud === "accept" || fraud === null ? "paid" : "review";
      break;
    case "pending":
    case "authorize":
      state = "pending";
      break;
    case "expire":
      state = "expired";
      break;
    case "cancel":
      state = "cancelled";
      break;
    case "deny":
    case "failure":
      state = "failed";
      break;
    case "refund":
    case "partial_refund":
    case "chargeback":
    case "partial_chargeback":
      state = "refunded";
      break;
    default:
      state = "pending";
  }

  return {
    state,
    raw,
    amountIdr: amount !== null && Number.isFinite(amount) ? amount : null,
    reference: str(n.transaction_id),
    paymentType: str(n.payment_type),
  };
}

/** Snap's item name is at most 50 characters. */
function itemName(name: string): string {
  return name.length <= 50 ? name : `${name.slice(0, 47)}...`;
}

export class MidtransProvider implements PaymentProvider {
  readonly name = "midtrans";
  private fetchImpl: FetchLike = fetch;

  constructor(private readonly config: MidtransConfig) {}

  /** Test seam: inject a fake fetch. */
  setFetch(fn: FetchLike): void {
    this.fetchImpl = fn;
  }

  private get snapBase(): string {
    return this.config.sandbox
      ? "https://app.sandbox.midtrans.com"
      : "https://app.midtrans.com";
  }

  private get coreBase(): string {
    return this.config.sandbox
      ? "https://api.sandbox.midtrans.com"
      : "https://api.midtrans.com";
  }

  private async request(
    url: string,
    init: RequestInit & { headers?: Record<string, string> },
  ): Promise<{ ok: boolean; status: number; body: unknown }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await this.fetchImpl(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${this.config.serverKey}:`).toString("base64")}`,
          ...init.headers,
        },
      });
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      return { ok: res.ok, status: res.status, body };
    } finally {
      clearTimeout(timer);
    }
  }

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    const minutes = Math.max(
      5,
      Math.ceil((request.expiresAt.getTime() - Date.now()) / 60_000),
    );
    const payload = {
      transaction_details: {
        order_id: request.paymentId,
        gross_amount: request.amountIdr,
      },
      customer_details: { email: request.customerEmail },
      item_details: request.lines.map((line) => ({
        id: line.id.slice(0, 50),
        price: line.unitPriceIdr,
        quantity: line.quantity,
        name: itemName(line.name),
      })),
      expiry: { unit: "minutes", duration: minutes },
      page_expiry: { unit: "minutes", duration: minutes },
      callbacks: { finish: request.finishUrl },
    };

    let res: { ok: boolean; status: number; body: unknown };
    try {
      res = await this.request(`${this.snapBase}/snap/v1/transactions`, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: this.config.notificationUrl
          ? { "X-Override-Notification": this.config.notificationUrl }
          : {},
      });
    } catch (error) {
      const reason =
        error instanceof Error && error.name === "AbortError"
          ? "Midtrans did not answer in time"
          : "Could not reach Midtrans";
      logger.error(reason, logSource, "charge");
      return { status: "failed", reason };
    }

    const data = (res.body ?? {}) as {
      token?: unknown;
      redirect_url?: unknown;
      error_messages?: unknown;
    };
    const redirectUrl = str(data.redirect_url);
    if (!res.ok || !redirectUrl) {
      const messages = Array.isArray(data.error_messages)
        ? data.error_messages.filter((m) => typeof m === "string").join("; ")
        : "";
      logger.error(
        `Snap create failed (HTTP ${res.status})${messages ? `: ${messages}` : ""}`,
        logSource,
        "charge",
      );
      return {
        status: "failed",
        reason: "The payment provider could not start the payment",
      };
    }

    return {
      status: "pending",
      reference: null,
      redirectUrl,
      token: str(data.token),
    };
  }

  async fetchStatus(paymentId: string): Promise<ProviderStatus | null> {
    const res = await this.request(
      `${this.coreBase}/v2/${encodeURIComponent(paymentId)}/status`,
      { method: "GET" },
    );
    const body = (res.body ?? {}) as MidtransNotification & {
      status_code?: unknown;
    };
    // Midtrans answers HTTP 200 with status_code "404" for unknown orders.
    if (res.status === 404 || body.status_code === "404") return null;
    if (res.status === 401 || body.status_code === "401") {
      throw new Error("Midtrans refused the server key");
    }
    if (!res.ok) throw new Error(`Midtrans status HTTP ${res.status}`);
    return midtransStatus(body);
  }

  /** Expire a pending transaction so it can no longer be paid. */
  async expire(paymentId: string): Promise<void> {
    const res = await this.request(
      `${this.coreBase}/v2/${encodeURIComponent(paymentId)}/expire`,
      { method: "POST" },
    );
    const body = (res.body ?? {}) as { status_code?: unknown };
    const code = typeof body.status_code === "string" ? body.status_code : "";
    // 404: the user never picked a way to pay, so there is nothing to close.
    // 407/412: already expired or no longer pending.
    if (res.status === 404 || ["404", "407", "412"].includes(code)) return;
    if (!res.ok || (code && !code.startsWith("2"))) {
      throw new Error(`Midtrans expire HTTP ${res.status} (${code || "-"})`);
    }
  }

  /** True when a notification was really signed by Midtrans with our key. */
  verifySignature(n: MidtransNotification): boolean {
    const orderId = str(n.order_id);
    const statusCode = str(n.status_code);
    const gross = str(n.gross_amount);
    const signature = str(n.signature_key);
    if (!orderId || !statusCode || !gross || !signature) return false;

    const expected = createHash("sha512")
      .update(`${orderId}${statusCode}${gross}${this.config.serverKey}`)
      .digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
