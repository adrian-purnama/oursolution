import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { formatMoney } from "./money";
import type {
  PaymentCurrency,
  PaymentStatus,
} from "../../models/payment/payment.interface";

export type InvoicePdfInput = {
  brand: string;
  siteUrl: string;
  supportEmail: string;
  invoiceNumber: string;
  status: PaymentStatus;
  customerEmail: string;
  createdAt: Date;
  expiresAt: Date;
  paidAt: Date | null;
  paymentType: string | null;
  items: {
    name: string;
    detail: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }[];
  amount: number;
  /** What the amounts are in: whole rupiah, or US cents. */
  currency: PaymentCurrency;
  /** Shown as a QR code on an unpaid invoice. */
  payUrl: string | null;
  /** PNG or JPEG bytes of the logo; the brand name is drawn when absent or unreadable. */
  logo?: Buffer | null;
};

const C = {
  primary: "#134e4a",
  accent: "#0f766e",
  text: "#1f2937",
  muted: "#6b7280",
  border: "#e5e7eb",
  light: "#f6f7f9",
  green: "#15803d",
  greenBg: "#ecfdf3",
  red: "#b42318",
  redBg: "#fef3f2",
  greyBg: "#f2f4f7",
};

const LEFT = 48;
const RIGHT = 547;
const WIDTH = RIGHT - LEFT;

function formatDateTime(date: Date): string {
  return `${new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
    hour12: false,
  }).format(date)} WIB`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function statusBadge(status: PaymentStatus): {
  text: string;
  color: string;
  bg: string;
} {
  switch (status) {
    case "paid":
      return { text: "PAID", color: C.green, bg: C.greenBg };
    case "pending":
      return { text: "UNPAID", color: C.red, bg: C.redBg };
    default:
      return { text: status.toUpperCase(), color: C.muted, bg: C.greyBg };
  }
}

/** An A4 invoice with every line of the payment. */
export async function buildInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  const isPaid = input.status === "paid" || input.status === "refunded";
  const qrPng =
    input.status === "pending" && input.payUrl
      ? await QRCode.toBuffer(input.payUrl, {
          type: "png",
          width: 220,
          margin: 1,
          errorCorrectionLevel: "M",
        })
      : null;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 48,
      info: {
        Title: `Invoice ${input.invoiceNumber}`,
        Author: input.brand,
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const hr = (y: number) =>
      doc
        .save()
        .strokeColor(C.border)
        .lineWidth(0.7)
        .moveTo(LEFT, y)
        .lineTo(RIGHT, y)
        .stroke()
        .restore();

    const metaCell = (
      label: string,
      value: string,
      x: number,
      y: number,
      width: number,
    ) => {
      doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor(C.muted)
        .text(label.toUpperCase(), x, y, { width });
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(C.text)
        .text(value, x, y + 11, { width });
    };

    // Header
    let logoDrawn = false;
    if (input.logo) {
      try {
        doc.image(input.logo, LEFT, 38, { fit: [180, 32] });
        logoDrawn = true;
      } catch {
        // Unsupported image format: fall back to the brand name.
      }
    }
    if (!logoDrawn) {
      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor(C.primary)
        .text(input.brand, LEFT, 42, { width: 240 });
    }
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor(C.primary)
      .text("INVOICE", 300, 40, { width: 145, align: "right" });
    const badge = statusBadge(input.status);
    doc.save().roundedRect(455, 38, 92, 24, 4).fill(badge.bg).restore();
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(badge.color)
      .text(badge.text, 455, 45, { width: 92, align: "center" });
    hr(78);

    // Parties
    const partyTop = 90;
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(C.muted)
      .text("FROM", LEFT, partyTop)
      .text("BILL TO", 300, partyTop);
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(C.text)
      .text(input.brand, LEFT, partyTop + 12, { width: 230 })
      .text(input.customerEmail, 300, partyTop + 12, { width: 245 });
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(C.muted)
      .text(input.siteUrl, LEFT, partyTop + 26, {
        width: 230,
        link: input.siteUrl,
      })
      .text(input.supportEmail, LEFT, partyTop + 38, {
        width: 230,
        link: `mailto:${input.supportEmail}`,
      });

    // Meta strip
    const metaTop = partyTop + 62;
    doc.save().roundedRect(LEFT, metaTop, WIDTH, 38, 4).fill(C.light).restore();
    metaCell("Invoice no.", input.invoiceNumber, LEFT + 10, metaTop + 8, 140);
    metaCell("Issued", formatDate(input.createdAt), 200, metaTop + 8, 90);
    metaCell(
      isPaid ? "Paid" : "Pay before",
      isPaid
        ? input.paidAt
          ? formatDateTime(input.paidAt)
          : "-"
        : formatDateTime(input.expiresAt),
      300,
      metaTop + 8,
      150,
    );
    metaCell("Currency", input.currency, 470, metaTop + 8, 70);

    // Line items
    const tableTop = metaTop + 52;
    const descX = LEFT + 10;
    const qtyX = 330;
    const unitX = 375;
    const amountX = 460;
    doc.save().rect(LEFT, tableTop, WIDTH, 22).fill(C.light).restore();
    doc
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .fillColor(C.muted)
      .text("DESCRIPTION", descX, tableTop + 7, { width: 260 })
      .text("QTY", qtyX, tableTop + 7, { width: 36, align: "right" })
      .text("UNIT PRICE", unitX, tableTop + 7, { width: 75, align: "right" })
      .text("AMOUNT", amountX, tableTop + 7, { width: 77, align: "right" });

    let y = tableTop + 30;
    for (const item of input.items) {
      if (y > 700) {
        doc.addPage();
        y = 60;
      }
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(C.text)
        .text(item.name, descX, y, { width: 260 });
      const nameHeight = doc.heightOfString(item.name, { width: 260 });
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(C.muted)
        .text(item.detail, descX, y + nameHeight + 2, { width: 260 });
      const detailHeight = item.detail
        ? doc.heightOfString(item.detail, { width: 260 })
        : 0;
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(C.text)
        .text(String(item.quantity), qtyX, y + 2, { width: 36, align: "right" })
        .text(formatMoney(item.unitPrice, input.currency), unitX, y + 2, {
          width: 75,
          align: "right",
        })
        .text(formatMoney(item.amount, input.currency), amountX, y + 2, {
          width: 77,
          align: "right",
        });
      y += Math.max(30, nameHeight + detailHeight + 12);
      hr(y - 6);
    }

    // Totals
    const labelX = 340;
    const valueX = 440;
    const row = (label: string, value: string, top: number) =>
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(C.muted)
        .text(label, labelX, top, { width: 90, align: "right" })
        .fillColor(C.text)
        .text(value, valueX, top, { width: 97, align: "right" });
    y += 6;
    row("Subtotal", formatMoney(input.amount, input.currency), y);
    row("Paid", formatMoney(isPaid ? input.amount : 0, input.currency), y + 16);
    const dueTop = y + 38;
    doc
      .save()
      .roundedRect(330, dueTop - 6, 217, 30, 4)
      .fill(C.light)
      .restore();
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(C.primary)
      .text(isPaid ? "TOTAL PAID" : "AMOUNT DUE", labelX, dueTop + 3, {
        width: 90,
        align: "right",
      });
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(isPaid ? C.green : C.primary)
      .text(formatMoney(input.amount, input.currency), valueX, dueTop + 1, {
        width: 97,
        align: "right",
      });

    // Notes
    let cursor = dueTop + 44;
    const notes = [
      `Status: ${badge.text}${input.paymentType ? ` · Paid with ${input.paymentType.replace(/_/g, " ")}` : ""}`,
      isPaid
        ? "Thank you. Your products are active on your account."
        : input.status === "pending"
          ? `Pay before ${formatDateTime(input.expiresAt)}. Unpaid invoices expire automatically.`
          : "This invoice was not paid. Nothing was charged.",
      input.currency === "USD"
        ? "Amounts are in US dollars (USD)."
        : "Amounts are in Indonesian Rupiah (IDR).",
    ];
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(C.primary)
      .text("NOTES", descX, cursor);
    // Inset like the item names and invoice details above it.
    const notesText = notes.join("\n");
    const notesWidth = WIDTH - 20;
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(C.muted)
      .text(notesText, descX, cursor + 12, { width: notesWidth, lineGap: 2 });
    cursor +=
      12 +
      doc.heightOfString(notesText, { width: notesWidth, lineGap: 2 }) +
      16;

    if (qrPng && input.payUrl) {
      if (cursor > 640) {
        doc.addPage();
        cursor = 60;
      }
      const boxH = 108;
      doc
        .save()
        .roundedRect(LEFT, cursor, WIDTH, boxH, 5)
        .fill(C.light)
        .restore();
      doc.image(qrPng, LEFT + 12, cursor + 12, { width: 84, height: 84 });
      const textX = LEFT + 128;
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(C.text)
        .text("Scan the QR code or open the payment page", textX, cursor + 18);
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(C.muted)
        .text(
          input.currency === "USD"
            ? "Pay securely by card or PayPal."
            : "Pay securely with bank transfer, e-wallet, QRIS or card.",
          textX,
          cursor + 34,
          { width: 340 },
        );
      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(C.accent)
        .text("Open payment page", textX, cursor + 58, {
          link: input.payUrl,
          underline: true,
        });
    }

    // Above the bottom margin, or pdfkit starts a new page for it.
    const footerY = 760;
    hr(footerY);
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(C.muted)
      .text(
        `Thank you for choosing ${input.brand}  ·  ${input.supportEmail}`,
        LEFT,
        footerY + 8,
        { width: WIDTH, align: "center", lineBreak: false },
      );

    doc.end();
  });
}
