/**
 * The seam for a real payment gateway. A provider is told what to charge and
 * answers whether the money is in, still on its way, or refused.
 */

export type ChargeRequest = {
  paymentId: string;
  userId: string;
  productId: string;
  amountIdr: number;
  description: string;
};

export type ChargeResult =
  /** Money is in: the product is granted right away. */
  | { status: "paid"; reference: string }
  /** The user must finish paying elsewhere; a webhook confirms it later. */
  | { status: "pending"; reference: string; redirectUrl: string }
  | { status: "failed"; reason: string };

export interface PaymentProvider {
  /** Stored on each payment, e.g. "allow-all", "midtrans". */
  readonly name: string;
  charge(request: ChargeRequest): Promise<ChargeResult>;
}

/**
 * Approves every checkout without taking money. A stand-in until a real
 * gateway is wired up: swap it in `payment.service.ts`.
 */
export const allowAllProvider: PaymentProvider = {
  name: "allow-all",
  async charge(request) {
    return { status: "paid", reference: `allow-all-${request.paymentId}` };
  },
};
