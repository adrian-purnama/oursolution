/**
 * A thin client for the Paddle Billing API: JSON in, `data` out, Paddle's
 * error turned into a thrown PaddleApiError. No SDK, like the Midtrans one.
 */
import { env } from "../../environment/env";

const REQUEST_TIMEOUT_MS = 15_000;

export type PaddleConfig = {
  apiKey: string;
  sandbox: boolean;
};

type FetchLike = typeof fetch;

export class PaddleApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    detail: string,
  ) {
    super(`Paddle HTTP ${status}${code ? ` ${code}` : ""}: ${detail}`);
  }
}

/** A Paddle price as we read it. */
export interface PaddlePrice {
  id: string;
  product_id: string;
  status: "active" | "archived";
  unit_price: { amount: string; currency_code: string };
  billing_cycle: { interval: string; frequency: number } | null;
}

/** A Paddle transaction as we read it. */
export interface PaddleTransaction {
  id: string;
  status: string;
  customer_id: string | null;
  subscription_id: string | null;
  origin: string | null;
  currency_code: string;
  custom_data: Record<string, unknown> | null;
  items: { price: { id: string } | null; price_id?: string; quantity: number }[];
  details: {
    totals?: { subtotal?: string; total?: string; grand_total?: string };
  } | null;
  payments?: { method_details?: { type?: string } | null }[] | null;
  checkout: { url: string | null } | null;
}

/** What Paddle says an update would do (the fields we read). */
export interface PaddleUpdatePreview {
  update_summary?: {
    credit?: { amount?: string; currency_code?: string } | null;
    charge?: { amount?: string; currency_code?: string } | null;
    result?: { action?: string; amount?: string; currency_code?: string } | null;
  } | null;
  immediate_transaction?: {
    details?: {
      totals?: { grand_total?: string; total?: string; currency_code?: string };
    };
  } | null;
  next_billed_at?: string | null;
}

export class PaddleClient {
  private fetchImpl: FetchLike = fetch;

  constructor(private readonly config: PaddleConfig) {}

  /** Test seam: inject a fake fetch. */
  setFetch(fn: FetchLike): void {
    this.fetchImpl = fn;
  }

  get sandbox(): boolean {
    return this.config.sandbox;
  }

  private get base(): string {
    return this.config.sandbox
      ? "https://sandbox-api.paddle.com"
      : "https://api.paddle.com";
  }

  async request<T>(
    method: "GET" | "POST" | "PATCH",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new Error(
        error instanceof Error && error.name === "AbortError"
          ? "Paddle did not answer in time"
          : "Could not reach Paddle",
      );
    } finally {
      clearTimeout(timer);
    }
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    if (!res.ok) {
      const error = (json as { error?: { code?: unknown; detail?: unknown } })
        ?.error;
      throw new PaddleApiError(
        res.status,
        typeof error?.code === "string" ? error.code : null,
        typeof error?.detail === "string" ? error.detail : "request refused",
      );
    }
    return (json as { data: T }).data;
  }

  /** The customer with this email, made when there is none yet. */
  async customerIdFor(email: string): Promise<string> {
    const found = await this.request<{ id: string }[]>(
      "GET",
      `/customers?email=${encodeURIComponent(email)}`,
    );
    if (found.length > 0) return found[0].id;
    const created = await this.request<{ id: string }>("POST", "/customers", {
      email,
    });
    return created.id;
  }

  getTransaction(id: string): Promise<PaddleTransaction> {
    return this.request("GET", `/transactions/${encodeURIComponent(id)}`);
  }

  getPrice(id: string): Promise<PaddlePrice> {
    return this.request("GET", `/prices/${encodeURIComponent(id)}`);
  }

  /** Stop renewing at the end of the period already paid for. */
  cancelSubscription(id: string): Promise<{
    scheduled_change: { action: string; effective_at: string } | null;
  }> {
    return this.request(
      "POST",
      `/subscriptions/${encodeURIComponent(id)}/cancel`,
      { effective_from: "next_billing_period" },
    );
  }

  /** What changing the subscription to one price would charge or credit now. */
  previewPriceChange(
    id: string,
    items: { price_id: string; quantity: number }[],
  ): Promise<PaddleUpdatePreview> {
    return this.request(
      "PATCH",
      `/subscriptions/${encodeURIComponent(id)}/preview`,
      {
        items,
        proration_billing_mode: "prorated_immediately",
        on_payment_failure: "prevent_change",
      },
    );
  }

  /**
   * Change the subscription's price now, billing the difference for the rest
   * of the period. Paddle leaves the change out when the payment fails.
   */
  changePrice(
    id: string,
    items: { price_id: string; quantity: number }[],
  ): Promise<{ id: string }> {
    return this.request("PATCH", `/subscriptions/${encodeURIComponent(id)}`, {
      items,
      proration_billing_mode: "prorated_immediately",
      on_payment_failure: "prevent_change",
    });
  }

  /** Take back a scheduled cancellation. */
  resumeSubscription(id: string): Promise<{ status: string }> {
    return this.request("PATCH", `/subscriptions/${encodeURIComponent(id)}`, {
      scheduled_change: null,
    });
  }

  /** The transaction that, paid in checkout, replaces the card on a subscription. */
  updatePaymentMethodTransaction(id: string): Promise<{ id: string }> {
    return this.request(
      "GET",
      `/subscriptions/${encodeURIComponent(id)}/update-payment-method-transaction`,
    );
  }

  /** A link to Paddle's page where the customer manages their billing. */
  async portalUrl(customerId: string, subscriptionIds: string[]): Promise<string> {
    const session = await this.request<{
      urls: { general: { overview: string } };
    }>("POST", `/customers/${encodeURIComponent(customerId)}/portal-sessions`, {
      subscription_ids: subscriptionIds,
    });
    return session.urls.general.overview;
  }
}

/** The app's Paddle client; null when PADDLE_API_KEY is not set. */
export const paddleClient: PaddleClient | null = env.paddleApiKey
  ? new PaddleClient({ apiKey: env.paddleApiKey, sandbox: env.paddleSandbox })
  : null;
