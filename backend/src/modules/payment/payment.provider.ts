/**
 * The seam for a payment gateway. A provider is told what to charge and
 * answers whether the money is in, still on its way, or refused; later it can
 * be asked how a payment stands.
 */

export type ChargeLine = {
  id: string;
  name: string;
  unitPriceIdr: number;
  quantity: number;
};

export type ChargeRequest = {
  paymentId: string;
  invoiceNumber: string;
  userId: string;
  customerEmail: string;
  amountIdr: number;
  lines: ChargeLine[];
  expiresAt: Date;
  /** Where the provider sends the user back after paying. */
  finishUrl: string;
};

export type ChargeResult =
  /** Money is in: the products are granted right away. */
  | { status: "paid"; reference: string }
  /** The user must finish paying elsewhere; a notification or poll confirms it. */
  | {
      status: "pending";
      reference: string | null;
      redirectUrl: string;
      /** Lets the page show the provider's payment form inline (Snap). */
      token: string | null;
    }
  | { status: "failed"; reason: string };

/** How a payment stands at the provider, in our terms. */
export type ProviderState =
  | "paid"
  | "pending"
  | "failed"
  | "expired"
  | "cancelled"
  | "refunded"
  /** Captured but not accepted by fraud checks: an admin decides. */
  | "review";

export type ProviderStatus = {
  state: ProviderState;
  /** The provider's raw status, e.g. "settlement". */
  raw: string;
  /** Amount the provider saw, when it says. */
  amountIdr: number | null;
  reference: string | null;
  paymentType: string | null;
};

export interface PaymentProvider {
  /** Stored on each payment, e.g. "allow-all", "midtrans". */
  readonly name: string;
  charge(request: ChargeRequest): Promise<ChargeResult>;
  /**
   * How the payment stands now. Null when the provider has no record of it
   * yet (e.g. the user has not picked a way to pay). Throws when it cannot
   * tell right now.
   */
  fetchStatus(paymentId: string): Promise<ProviderStatus | null>;
  /**
   * Stop a pending payment from being paid (e.g. close its virtual
   * account). Optional; nothing to do when the user never picked a way to
   * pay. Throws when the provider refuses.
   */
  expire?(paymentId: string): Promise<void>;
}

/**
 * Approves every checkout without taking money. Used in development when no
 * Midtrans key is set.
 */
export const allowAllProvider: PaymentProvider = {
  name: "allow-all",
  async charge(request) {
    return { status: "paid", reference: `allow-all-${request.paymentId}` };
  },
  async fetchStatus() {
    return null;
  },
};
