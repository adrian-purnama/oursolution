import type { PaymentStatus } from "../models/payment/payment.interface";

export interface CheckoutInDto {
  productId: string;
}

export interface CheckoutOutDto {
  paymentId: string;
  status: PaymentStatus;
  /** Where to send the user to pay, for providers that need it. */
  redirectUrl: string | null;
}
