import { readFileSync } from "node:fs";
import path from "node:path";
import nodemailer, { type SendMailOptions, type Transporter } from "nodemailer";
import { env } from "../../environment/env";
import { logger } from "../../logger/logger";
import { appConfigService } from "../appConfig/appConfig.service";

/** Brand palette, matching the tokens in frontend/src/styles.css. */
const color = {
  navy: "#002060",
  accent: "#135ef5",
  ink: "#0c0c0b",
  body: "#3d3d3a",
  muted: "#6b6b6b",
  faint: "#9a9893",
  line: "#e5e2dc",
  surface: "#f7f7f5",
  page: "#f1efeb",
};

const sans =
  "Geist,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const mono =
  "'Geist Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

/** Content id the logo is attached under; the layout shows it as cid:${LOGO_CID}. */
const LOGO_CID = "brand-logo@oursolution";

/**
 * The logo is read once and attached inline to every email, so it shows
 * without the mail client fetching a remote image. src/ and dist/ sit at the
 * same depth, so this path works in dev and in the build.
 */
const logo: Buffer | null = (() => {
  try {
    return readFileSync(path.join(__dirname, "../../../assets/email-logo.png"));
  } catch (error) {
    logger.error(
      `Email logo not found, sending emails without it: ${error instanceof Error ? error.message : String(error)}`,
      "modules/mail/mail.service.ts",
      "logo",
    );
    return null;
  }
})();

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The app name configured by the admin, safe to place in HTML. */
function brand(): string {
  return escapeHtml(appConfigService.appName);
}

function layout(title: string, heading: string, innerHtml: string): string {
  const mark = logo
    ? `<img src="cid:${LOGO_CID}" width="160" height="32" alt="${brand()}" style="display:block;width:160px;height:32px;border:0;outline:none;text-decoration:none;" />`
    : `<p style="margin:0;font-family:${sans};font-size:18px;font-weight:700;color:${color.navy};">${brand()}</p>`;
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${color.page};font-family:${sans};-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${color.page};padding:40px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background-color:#ffffff;border:1px solid ${color.line};border-radius:16px;overflow:hidden;">
        <tr>
          <td style="height:4px;line-height:4px;font-size:0;background-color:${color.navy};background-image:linear-gradient(90deg,${color.navy} 0%,${color.accent} 100%);">&nbsp;</td>
        </tr>
        <tr>
          <td style="padding:28px 36px 24px;border-bottom:1px solid ${color.line};">
            ${mark}
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px 8px;">
            <h1 style="margin:0;font-family:${sans};font-size:24px;font-weight:600;letter-spacing:-0.01em;line-height:1.3;color:${color.ink};">${heading}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 36px 36px;">
            ${innerHtml}
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;">
        <tr>
          <td style="padding:24px 4px 0;text-align:center;">
            <p style="margin:0 0 4px;font-family:${sans};font-size:12px;line-height:1.5;color:${color.muted};">
              Sent by ${brand()}. Please don’t reply to this email.
            </p>
            <p style="margin:0;font-family:${sans};font-size:12px;line-height:1.5;color:${color.faint};">
              © ${new Date().getFullYear()} ${brand()}
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
`;
}

class MailService {
  private readonly transporter: Transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: { user: env.smtpUser, pass: env.smtpPassword },
  });
  private readonly source = "modules/mail/mail.service.ts";

  constructor() {
    void this.transporter
      .verify()
      .then(() => {
        logger.debug("SMTP connection is ready", this.source, "verify");
      })
      .catch((error: unknown) => {
        logger.error(
          error instanceof Error ? error.message : String(error),
          this.source,
          "verify",
        );
      });
  }

  /** Sent from MAIL_FROM under the app name the admin configured. */
  private async sendMail(options: {
    to: string | string[];
    subject: string;
    html: string;
    attachments?: SendMailOptions["attachments"];
  }): Promise<void> {
    await this.transporter.sendMail({
      from: { name: appConfigService.appName, address: env.mailFrom },
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: [
        ...(logo
          ? [
              {
                filename: "logo.png",
                content: logo,
                contentType: "image/png",
                cid: LOGO_CID,
                contentDisposition: "inline" as const,
              },
            ]
          : []),
        ...(options.attachments ?? []),
      ],
    });
  }

  async sendOtp(to: string, otp: string): Promise<boolean> {
    try {
      await this.sendMail({
        subject: "Your verification code",
        to,
        html: layout(
          "Verification code",
          "Verify your email",
          `
            <p style="margin:0 0 8px;font-family:${sans};font-size:15px;line-height:1.6;color:${color.body};">
              Use this one-time code to finish signing up. It expires shortly, so don’t share it with anyone.
            </p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:28px 0;">
              <tr>
                <td align="center" style="background-color:${color.surface};border:1px solid ${color.line};border-radius:10px;padding:22px 16px;">
                  <p style="margin:0 0 6px;font-family:${sans};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${color.muted};">Your code</p>
                  <p style="margin:0;font-family:${mono};font-size:36px;font-weight:700;letter-spacing:0.28em;color:${color.navy};">
                    ${otp}
                  </p>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-family:${sans};font-size:13px;line-height:1.5;color:${color.faint};">
              If you didn’t request this, you can ignore this email.
            </p>
          `,
        ),
      });

      logger.debug(`OTP email sent to ${to}`, this.source, "sendOtp");
      return true;
    } catch (error) {
      logger.error(
        error instanceof Error ? error.message : String(error),
        this.source,
        "sendOtp",
      );
      return false;
    }
  }

  async sendResetPasswordLink(to: string, resetUrl: string): Promise<boolean> {
    try {
      await this.sendMail({
        subject: "Reset your password",
        to,
        html: layout(
          "Reset your password",
          "Reset your password",
          `
            <p style="margin:0 0 24px;font-family:${sans};font-size:15px;line-height:1.6;color:${color.body};">
              Click the button below to choose a new password. This link expires shortly.
            </p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center">
                  <a href="${resetUrl}" style="display:inline-block;background-color:${color.navy};color:#ffffff;font-family:${sans};font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:8px;">
                    Reset password
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;font-family:${sans};font-size:13px;line-height:1.5;color:${color.faint};word-break:break-all;">
              Or copy and paste this link into your browser:<br />
              <a href="${resetUrl}" style="color:${color.navy};">${resetUrl}</a>
            </p>
            <p style="margin:24px 0 0;font-family:${sans};font-size:13px;line-height:1.5;color:${color.faint};">
              If you didn't request this, you can ignore this email.
            </p>
          `,
        ),
      });

      logger.debug(
        `Reset password email sent to ${to} - ${resetUrl}`,
        this.source,
        "sendResetPasswordLink",
      );
      return true;
    } catch (error) {
      logger.error(
        error instanceof Error ? error.message : String(error),
        this.source,
        "sendResetPasswordLink",
      );
      return false;
    }
  }

  /** A notification sent by email; every value is escaped. */
  async sendNotification(
    to: string,
    notification: {
      title: string;
      body: string;
      url: string | null;
      /** The button's text; "Open" when absent. */
      buttonLabel?: string;
    },
  ): Promise<boolean> {
    const body = escapeHtml(notification.body).replace(/\n/g, "<br />");
    const button = notification.url
      ? `
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;">
              <tr>
                <td align="center">
                  <a href="${escapeHtml(notification.url)}" style="display:inline-block;background-color:${color.navy};color:#ffffff;font-family:${sans};font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:8px;">
                    ${escapeHtml(notification.buttonLabel || "Open")}
                  </a>
                </td>
              </tr>
            </table>`
      : "";
    try {
      await this.sendMail({
        // A header, not HTML; the title is one line of plain text.
        subject: notification.title,
        to,
        html: layout(
          escapeHtml(notification.title),
          escapeHtml(notification.title),
          `
            <p style="margin:0;font-family:${sans};font-size:15px;line-height:1.6;color:${color.body};">
              ${body}
            </p>${button}
          `,
        ),
      });
      return true;
    } catch (error) {
      logger.error(
        `Failed to send the notification email: ${error instanceof Error ? error.message : String(error)}`,
        this.source,
        "sendNotification",
      );
      return false;
    }
  }

  /** Tells admins which step of a customer's deployment failed and why. */
  async sendDeploymentFailure(
    to: string[],
    failure: {
      customerEmail: string;
      productName: string;
      action: string;
      step: string;
      reason: string;
      adminUrl: string;
    },
  ): Promise<boolean> {
    if (to.length === 0) return false;
    const row = (label: string, value: string) => `
      <tr>
        <td style="padding:6px 12px 6px 0;font-family:${sans};font-size:13px;color:${color.muted};vertical-align:top;white-space:nowrap;">${label}</td>
        <td style="padding:6px 0;font-family:${sans};font-size:14px;color:${color.ink};word-break:break-word;">${escapeHtml(value)}</td>
      </tr>`;
    try {
      await this.sendMail({
        subject: `Deployment failed: ${failure.productName} for ${failure.customerEmail}`,
        to,
        html: layout(
          "Deployment failed",
          "A deployment failed",
          `
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
              ${row("Customer", failure.customerEmail)}
              ${row("Product", failure.productName)}
              ${row("Action", failure.action)}
              ${row("Failed step", failure.step)}
              ${row("Reason", failure.reason)}
            </table>
            <a href="${escapeHtml(failure.adminUrl)}" style="display:inline-block;background-color:${color.navy};color:#ffffff;font-family:${sans};font-size:14px;font-weight:600;text-decoration:none;padding:12px 20px;border-radius:8px;">Open the customer's deployments</a>
          `,
        ),
      });
      return true;
    } catch (error) {
      logger.error(
        `Failed to send the deployment failure email: ${error instanceof Error ? error.message : String(error)}`,
        this.source,
        "sendDeploymentFailure",
      );
      return false;
    }
  }

  /** An invoice is waiting to be paid, with the invoice PDF attached. */
  async sendInvoiceIssued(
    to: string,
    invoice: {
      invoiceNumber: string;
      items: { name: string; quantity: number; amount: string }[];
      total: string;
      dueAt: string;
      invoiceUrl: string;
      pdf: Buffer;
    },
  ): Promise<boolean> {
    const rows = invoice.items
      .map(
        (item) => `
      <tr>
        <td style="padding:8px 0;font-family:${sans};font-size:14px;color:${color.ink};border-bottom:1px solid ${color.line};">${escapeHtml(item.name)}${item.quantity > 1 ? ` &times; ${item.quantity}` : ""}</td>
        <td style="padding:8px 0;font-family:${sans};font-size:14px;color:${color.ink};text-align:right;white-space:nowrap;border-bottom:1px solid ${color.line};">${escapeHtml(item.amount)}</td>
      </tr>`,
      )
      .join("");
    try {
      await this.sendMail({
        subject: `Invoice ${invoice.invoiceNumber}: ${invoice.total}`,
        to,
        html: layout(
          "New invoice",
          "You have a new invoice",
          `
            <p style="margin:0 0 20px;font-family:${sans};font-size:15px;line-height:1.6;color:${color.body};">
              Invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> is ready. Please pay it by <strong>${escapeHtml(invoice.dueAt)}</strong>. The invoice is attached.
            </p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 8px;">
              ${rows}
              <tr>
                <td style="padding:10px 0;font-family:${sans};font-size:14px;font-weight:700;color:${color.ink};">Total due</td>
                <td style="padding:10px 0;font-family:${sans};font-size:14px;font-weight:700;color:${color.navy};text-align:right;white-space:nowrap;">${escapeHtml(invoice.total)}</td>
              </tr>
            </table>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;">
              <tr>
                <td align="center">
                  <a href="${escapeHtml(invoice.invoiceUrl)}" style="display:inline-block;background-color:${color.navy};color:#ffffff;font-family:${sans};font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:8px;">
                    View and pay
                  </a>
                </td>
              </tr>
            </table>
          `,
        ),
        attachments: [
          {
            filename: `${invoice.invoiceNumber}.pdf`,
            content: invoice.pdf,
            contentType: "application/pdf",
          },
        ],
      });
      return true;
    } catch (error) {
      logger.error(
        `Failed to send the new invoice email: ${error instanceof Error ? error.message : String(error)}`,
        this.source,
        "sendInvoiceIssued",
      );
      return false;
    }
  }

  /** Receipt for a paid invoice, with the invoice PDF attached. */
  async sendInvoicePaid(
    to: string,
    invoice: {
      invoiceNumber: string;
      items: { name: string; quantity: number; amount: string }[];
      total: string;
      invoiceUrl: string;
      pdf: Buffer;
    },
  ): Promise<boolean> {
    const rows = invoice.items
      .map(
        (item) => `
      <tr>
        <td style="padding:8px 0;font-family:${sans};font-size:14px;color:${color.ink};border-bottom:1px solid ${color.line};">${escapeHtml(item.name)}${item.quantity > 1 ? ` &times; ${item.quantity}` : ""}</td>
        <td style="padding:8px 0;font-family:${sans};font-size:14px;color:${color.ink};text-align:right;white-space:nowrap;border-bottom:1px solid ${color.line};">${escapeHtml(item.amount)}</td>
      </tr>`,
      )
      .join("");
    try {
      await this.sendMail({
        subject: `Payment received: ${invoice.invoiceNumber}`,
        to,
        html: layout(
          "Payment received",
          "Thank you for your payment",
          `
            <p style="margin:0 0 20px;font-family:${sans};font-size:15px;line-height:1.6;color:${color.body};">
              We received your payment for invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong>. Anything you bought from the store is now active on your account. The invoice is attached.
            </p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 8px;">
              ${rows}
              <tr>
                <td style="padding:10px 0;font-family:${sans};font-size:14px;font-weight:700;color:${color.ink};">Total paid</td>
                <td style="padding:10px 0;font-family:${sans};font-size:14px;font-weight:700;color:${color.navy};text-align:right;white-space:nowrap;">${escapeHtml(invoice.total)}</td>
              </tr>
            </table>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;">
              <tr>
                <td align="center">
                  <a href="${escapeHtml(invoice.invoiceUrl)}" style="display:inline-block;background-color:${color.navy};color:#ffffff;font-family:${sans};font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:8px;">
                    View invoice
                  </a>
                </td>
              </tr>
            </table>
          `,
        ),
        attachments: [
          {
            filename: `${invoice.invoiceNumber}.pdf`,
            content: invoice.pdf,
            contentType: "application/pdf",
          },
        ],
      });
      return true;
    } catch (error) {
      logger.error(
        `Failed to send the invoice email: ${error instanceof Error ? error.message : String(error)}`,
        this.source,
        "sendInvoicePaid",
      );
      return false;
    }
  }
}

export const mailer = new MailService();
