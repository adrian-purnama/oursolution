import type { PaymentCurrency } from "../../models/payment/payment.interface";

/** "Rp 50.000" */
export function formatIdr(value: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value)}`;
}

/** "Rp 50.000" for rupiah, "$9.00" for US cents. */
export function formatMoney(value: number, currency: PaymentCurrency): string {
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value / 100);
  }
  return formatIdr(value);
}
