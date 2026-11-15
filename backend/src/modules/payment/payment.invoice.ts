import { env } from "../../environment/env";
import { UserModel } from "../../models/user/user.model";
import { appConfigService } from "../appConfig/appConfig.service";
import { mailer } from "../mail/mail.service";
import { notificationService } from "../notification/notification.service";
import { buildInvoicePdf, formatIdr } from "./invoice.pdf";
import { mongoPaymentStore, type PaymentRecord } from "./payment.service";

function siteUrl(): string {
  return env.frontendUrl.replace(/\/+$/, "");
}

/** The user's page for one invoice; also where Midtrans sends them back. */
export function invoicePageUrl(paymentId: string): string {
  return `${siteUrl()}/billing/${paymentId}`;
}

function itemDetail(item: PaymentRecord["items"][number]): string {
  let kind: string;
  if (item.kind === "custom") kind = "";
  else if (item.kind === "oneTime") kind = "One-time purchase";
  else {
    const days = item.durationDays ?? 0;
    kind =
      item.quantity > 1
        ? `Subscription · ${item.quantity} periods of ${days} days`
        : `Subscription · ${days} days`;
  }
  return [kind, item.description].filter(Boolean).join("\n");
}

export async function invoicePdfFor(
  payment: PaymentRecord,
): Promise<{ buffer: Buffer; filename: string }> {
  const user = await UserModel.findById(payment.userId)
    .select("email")
    .lean()
    .exec();
  const buffer = await buildInvoicePdf({
    brand: appConfigService.appName,
    siteUrl: siteUrl(),
    supportEmail: env.mailFrom,
    invoiceNumber: payment.invoiceNumber,
    status: payment.status,
    customerEmail: user?.email ?? "-",
    createdAt: payment.createdAt ?? new Date(),
    expiresAt: payment.expiresAt,
    paidAt: payment.paidAt,
    paymentType: payment.paymentType,
    items: payment.items.map((item) => ({
      name: item.name,
      detail: itemDetail(item),
      quantity: item.quantity,
      unitPriceIdr: item.unitPriceIdr,
      amountIdr: item.amountIdr,
    })),
    amountIdr: payment.amountIdr,
    payUrl: payment.status === "pending" ? invoicePageUrl(payment.id) : null,
  });
  return { buffer, filename: `${payment.invoiceNumber}.pdf` };
}

function emailItems(payment: PaymentRecord) {
  return payment.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    amount: formatIdr(item.amountIdr),
  }));
}

/**
 * An admin made an invoice: tell the user it is waiting, in the app and by
 * email with the PDF.
 */
export async function notifyInvoiceIssued(paymentId: string): Promise<void> {
  const payment = await mongoPaymentStore.get(paymentId);
  if (!payment || payment.status !== "pending") return;
  const total = formatIdr(payment.amountIdr);
  const dueAt = payment.expiresAt.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  await notificationService.send(
    {
      userId: payment.userId,
      title: `Invoice ${payment.invoiceNumber} is ready`,
      body: `${total} is due by ${dueAt}.`,
      link: `/billing/${payment.id}`,
      channels: "both",
    },
    {
      customEmail: async (to) => {
        const { buffer } = await invoicePdfFor(payment);
        return mailer.sendInvoiceIssued(to, {
          invoiceNumber: payment.invoiceNumber,
          items: emailItems(payment),
          total,
          dueAt,
          invoiceUrl: invoicePageUrl(payment.id),
          pdf: buffer,
        });
      },
    },
  );
}

/**
 * After a payment is granted: tell the user in the app, and email the
 * receipt with the invoice PDF.
 */
export async function notifyPaymentReceived(paymentId: string): Promise<void> {
  const payment = await mongoPaymentStore.get(paymentId);
  if (!payment) return;
  const total = formatIdr(payment.amountIdr);
  await notificationService.send(
    {
      userId: payment.userId,
      title: "Payment received",
      body: `Invoice ${payment.invoiceNumber} (${total}) is paid. Anything you bought is now active.`,
      link: `/billing/${payment.id}`,
      channels: "both",
    },
    {
      customEmail: async (to) => {
        const { buffer } = await invoicePdfFor(payment);
        return mailer.sendInvoicePaid(to, {
          invoiceNumber: payment.invoiceNumber,
          items: emailItems(payment),
          total,
          invoiceUrl: invoicePageUrl(payment.id),
          pdf: buffer,
        });
      },
    },
  );
}
