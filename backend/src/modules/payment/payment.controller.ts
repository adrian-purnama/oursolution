import type { Request, Response } from "express";
import type {
  AdminPaymentListOutDto,
  BillingRegionOutDto,
  CheckoutOutDto,
  CheckoutQuoteOutDto,
  PaymentConfigOutDto,
  PaymentListOutDto,
  PaymentOutDto,
  PaddleSubscriptionOutDto,
  UpgradeChoiceOutDto,
  UpgradePreviewOutDto,
} from "../../dto/payment.dto";
import {
  BILLING_REGIONS,
  type BillingRegion,
} from "../../models/user/user.interface";
import { env } from "../../environment/env";
import { logger } from "../../logger/logger";
import { UserModel } from "../../models/user/user.model";
import { parseRouteId } from "../../validation/parseParam";
import {
  parseAdminInvoiceInDto,
  parseCheckoutInDto,
  parseCheckoutQuoteInDto,
  parsePageQuery,
} from "../../validation/payment";
import { basketService } from "../basket/basket.service";
import {
  MidtransProvider,
  type MidtransNotification,
} from "./midtrans.provider";
import { verifyPaddleSignature } from "./paddle.provider";
import {
  PaddleEventError,
  paddleService,
  type PaddleEvent,
} from "./paddle.service";
import { notifyInvoiceIssued, invoicePdfFor } from "./payment.invoice";
import {
  listAllPayments,
  listPayments,
  mongoPaymentStore,
  PAYMENT_GROUPS,
  type PaymentGroup,
  paddleProvider,
  paymentProvider,
  paymentService,
  toPaymentOut,
  type PaymentRecord,
} from "./payment.service";
import { fail, ok, refuse } from "../../utils/respond";
import { UserError } from "../../utils/userError";

const logSource = "modules/payment/payment.controller.ts";

function parseRegion(body: unknown): BillingRegion {
  const region = (body as { region?: unknown } | null)?.region;
  if (
    typeof region !== "string" ||
    !(BILLING_REGIONS as readonly string[]).includes(region)
  ) {
    throw new Error(`region must be one of ${BILLING_REGIONS.join(", ")}`);
  }
  return region as BillingRegion;
}

async function regionOut(userId: string): Promise<BillingRegionOutDto> {
  const { region, locked } = await paymentService.regionOf(userId);
  return { region, locked, international: paddleProvider !== null };
}

function sendPdf(res: Response, pdf: { buffer: Buffer; filename: string }) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${pdf.filename}"`,
  );
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).send(pdf.buffer);
}

async function withUser(payment: PaymentRecord): Promise<PaymentOutDto> {
  const user = await UserModel.findById(payment.userId)
    .select("email")
    .lean()
    .exec();
  return toPaymentOut(
    payment,
    user ? { id: payment.userId.toString(), email: user.email } : null,
  );
}

export class PaymentController {
  /** Public: how the browser shows the payment form. */
  config = (_req: Request, res: Response) => {
    const snap =
      paymentProvider instanceof MidtransProvider && env.midtransClientKey
        ? {
            scriptUrl: env.midtransSandbox
              ? "https://app.sandbox.midtrans.com/snap/snap.js"
              : "https://app.midtrans.com/snap/snap.js",
            clientKey: env.midtransClientKey,
          }
        : null;
    const paddle =
      paddleProvider && env.paddleClientToken
        ? {
            clientToken: env.paddleClientToken,
            environment: env.paddleSandbox
              ? ("sandbox" as const)
              : ("production" as const),
          }
        : null;
    return ok<PaymentConfigOutDto>(res, "Payment config", {
      provider: paymentProvider?.name ?? null,
      snap,
      paddle,
    });
  };

  /** Admin: a user's region, locked or not. */
  getUserRegion = async (req: Request, res: Response) => {
    try {
      const userId = parseRouteId(req.params.id);
      return ok<BillingRegionOutDto>(
        res,
        "Billing region",
        await regionOut(userId),
      );
    } catch (error) {
      return fail(res, error, "Could not load the billing region");
    }
  };

  /** Admin: body `{ region, locked? }`. Unlocking lets the user choose again. */
  setUserRegion = async (req: Request, res: Response) => {
    try {
      const userId = parseRouteId(req.params.id);
      const region = parseRegion(req.body);
      const rawLocked = (req.body as { locked?: unknown }).locked;
      if (rawLocked !== undefined && typeof rawLocked !== "boolean") {
        throw new Error("locked must be true or false");
      }
      const updated = await UserModel.updateOne(
        { _id: userId },
        {
          $set: {
            billingRegion: region,
            ...(rawLocked !== undefined
              ? { billingRegionLocked: rawLocked }
              : {}),
          },
        },
      ).exec();
      if (updated.matchedCount === 0) throw new Error("User not found");
      return ok<BillingRegionOutDto>(
        res,
        "Billing region saved",
        await regionOut(userId),
      );
    } catch (error) {
      return fail(res, error, "Could not save the billing region");
    }
  };

  listOwnSubscriptions = async (req: Request, res: Response) => {
    try {
      return ok<PaddleSubscriptionOutDto[]>(
        res,
        "Subscriptions retrieved",
        await paddleService.listFor(req.user!.id),
      );
    } catch (error) {
      return fail(res, error, "Could not load subscriptions");
    }
  };

  cancelRenewal = async (req: Request, res: Response) => {
    try {
      await paddleService.cancelRenewal(req.user!.id, String(req.params.id));
      return ok(res, "Renewal cancelled", null);
    } catch (error) {
      return fail(res, error, "Could not cancel the renewal");
    }
  };

  resumeRenewal = async (req: Request, res: Response) => {
    try {
      await paddleService.resumeRenewal(req.user!.id, String(req.params.id));
      return ok(res, "Renewal resumed", null);
    } catch (error) {
      return fail(res, error, "Could not resume the renewal");
    }
  };

  upgradeChoices = async (req: Request, res: Response) => {
    try {
      return ok<UpgradeChoiceOutDto[]>(
        res,
        "Upgrade choices",
        await paddleService.upgradeChoices(req.user!.id, String(req.params.id)),
      );
    } catch (error) {
      return fail(res, error, "Could not load the variants");
    }
  };

  upgradePreview = async (req: Request, res: Response) => {
    try {
      return ok<UpgradePreviewOutDto>(
        res,
        "Upgrade preview",
        await paddleService.previewUpgrade(
          req.user!.id,
          String(req.params.id),
          String(req.body?.variantId ?? ""),
        ),
      );
    } catch (error) {
      return fail(res, error, "Could not preview the change");
    }
  };

  upgrade = async (req: Request, res: Response) => {
    try {
      await paddleService.upgrade(
        req.user!.id,
        String(req.params.id),
        String(req.body?.variantId ?? ""),
      );
      return ok(res, "Subscription changed", null);
    } catch (error) {
      return fail(res, error, "Could not change the subscription");
    }
  };

  cancelScheduledChange = async (req: Request, res: Response) => {
    try {
      await paddleService.cancelScheduledChange(
        req.user!.id,
        String(req.params.id),
      );
      return ok(res, "Scheduled change cancelled", null);
    } catch (error) {
      return fail(res, error, "Could not cancel the change");
    }
  };

  cardTransaction = async (req: Request, res: Response) => {
    try {
      const transactionId = await paddleService.cardTransactionId(
        req.user!.id,
        String(req.params.id),
      );
      return ok<{ transactionId: string }>(res, "Card update", {
        transactionId,
      });
    } catch (error) {
      return fail(res, error, "Could not start the card update");
    }
  };

  /**
   * Paddle's webhook. Public: trusted only when the Paddle-Signature header
   * signs the raw body with our secret. Answers 500 when an event cannot be
   * applied yet, so Paddle sends it again later.
   */
  paddleWebhook = async (req: Request, res: Response) => {
    if (!paddleProvider || !env.paddleWebhookSecret) {
      return refuse(res, 404, "Paddle is not set up");
    }
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (
      !verifyPaddleSignature(
        raw,
        req.header("paddle-signature"),
        env.paddleWebhookSecret,
      )
    ) {
      logger.warn(
        "Paddle webhook with a bad signature",
        logSource,
        "paddleWebhook",
      );
      return refuse(res, 403, "Invalid signature");
    }
    let event: PaddleEvent;
    try {
      event = JSON.parse(raw.toString("utf8")) as PaddleEvent;
    } catch {
      return refuse(res, 400, "Invalid JSON");
    }
    try {
      await paddleService.handle(event);
      return ok(res, "OK", null);
    } catch (error) {
      const level = error instanceof PaddleEventError ? "warn" : "error";
      logger[level](
        `Paddle ${event.event_type ?? "event"} ${event.event_id ?? ""}: ${error instanceof Error ? error.message : String(error)}`,
        logSource,
        "paddleWebhook",
      );
      return refuse(res, 500, "Could not process the webhook");
    }
  };

  quote = async (req: Request, res: Response) => {
    try {
      const { items } = parseCheckoutQuoteInDto(req.body);
      const data = await paymentService.quote(req.user!.id, items);
      return ok<CheckoutQuoteOutDto>(res, "Checkout priced", data);
    } catch (error) {
      return fail(res, error, "Could not price the checkout");
    }
  };

  checkout = async (req: Request, res: Response) => {
    try {
      const input = parseCheckoutInDto(req.body);
      const data = await paymentService.checkout(req.user!.id, input);
      if (input.fromBasket) {
        await basketService
          .remove(
            req.user!.id,
            input.items.map((item) => item.productId),
          )
          .catch((error: unknown) =>
            logger.warn(
              `Could not empty the basket: ${error instanceof Error ? error.message : String(error)}`,
              logSource,
              "checkout",
            ),
          );
      }
      return ok<CheckoutOutDto>(
        res,
        data.status === "paid" ? "Payment received" : "Payment started",
        data,
      );
    } catch (error) {
      return fail(res, error, "Checkout failed");
    }
  };

  listOwn = async (req: Request, res: Response) => {
    try {
      const { page, pageSize } = parsePageQuery(req.query);
      // ?status=unpaid: only invoices that can still be paid.
      const data = await listPayments(
        { userId: req.user!.id, unpaidOnly: req.query.status === "unpaid" },
        page,
        pageSize,
        false,
      );
      return ok<PaymentListOutDto>(res, "Payments retrieved", data);
    } catch (error) {
      return fail(res, error, "Failed to load payments");
    }
  };

  /** Also asks the provider how a pending payment stands. */
  getOwn = async (req: Request, res: Response) => {
    try {
      const id = parseRouteId(req.params.id);
      await paymentService.getOwn(req.user!.id, id);
      await paymentService.refresh(id).catch(() => undefined);
      const payment = await paymentService.getOwn(req.user!.id, id);
      return ok<PaymentOutDto>(res, "Payment retrieved", toPaymentOut(payment));
    } catch (error) {
      return fail(res, error, "Failed to load the payment");
    }
  };

  cancelOwn = async (req: Request, res: Response) => {
    try {
      const data = await paymentService.cancel(
        req.user!.id,
        parseRouteId(req.params.id),
      );
      return ok<PaymentOutDto>(res, "Invoice cancelled", data);
    } catch (error) {
      return fail(res, error, "Could not cancel the invoice");
    }
  };

  invoiceOwn = async (req: Request, res: Response) => {
    try {
      const payment = await paymentService.getOwn(
        req.user!.id,
        parseRouteId(req.params.id),
      );
      return sendPdf(res, await invoicePdfFor(payment));
    } catch (error) {
      return fail(res, error, "Could not make the invoice");
    }
  };

  listForUser = async (req: Request, res: Response) => {
    try {
      const userId = parseRouteId(req.params.id);
      const { page, pageSize } = parsePageQuery(req.query);
      const data = await listPayments({ userId }, page, pageSize, true);
      return ok<PaymentListOutDto>(res, "Payments retrieved", data);
    } catch (error) {
      return fail(res, error, "Failed to load payments");
    }
  };

  /** Admin: every user's payments, by status group and email search. */
  listAll = async (req: Request, res: Response) => {
    try {
      const { page, pageSize } = parsePageQuery(req.query);
      const rawGroup = req.query.status;
      const group =
        typeof rawGroup === "string" && rawGroup in PAYMENT_GROUPS
          ? (rawGroup as PaymentGroup)
          : null;
      const rawSearch = req.query.search;
      const search =
        typeof rawSearch === "string" ? rawSearch.slice(0, 200) : "";
      const data = await listAllPayments({ group, search }, page, pageSize);
      return ok<AdminPaymentListOutDto>(res, "Payments retrieved", data);
    } catch (error) {
      return fail(res, error, "Failed to load payments");
    }
  };

  /** Admin: bill a user, with store products at any price or custom lines. */
  createForUser = async (req: Request, res: Response) => {
    try {
      const userId = parseRouteId(req.params.id);
      const input = parseAdminInvoiceInDto(req.body);
      const created = await paymentService.issueForUser(userId, input);
      const payment = await mongoPaymentStore.get(created.paymentId);
      if (!payment) throw new UserError("Invoice not found", 404);
      if (input.notify && payment.status === "pending") {
        void notifyInvoiceIssued(payment.id).catch((error: unknown) =>
          logger.error(
            `Could not send invoice ${payment.invoiceNumber}: ${error instanceof Error ? error.message : String(error)}`,
            logSource,
            "createForUser",
          ),
        );
      }
      return ok<PaymentOutDto>(
        res,
        payment.status === "paid"
          ? `Invoice ${payment.invoiceNumber} made and marked paid`
          : `Invoice ${payment.invoiceNumber} sent`,
        await withUser(payment),
        201,
      );
    } catch (error) {
      return fail(res, error, "Could not make the invoice");
    }
  };

  /** Admin: one payment, after asking the provider about it. */
  getAny = async (req: Request, res: Response) => {
    try {
      const id = parseRouteId(req.params.paymentId);
      await paymentService.refresh(id).catch(() => undefined);
      const payment = await mongoPaymentStore.get(id);
      if (!payment) throw new UserError("Invoice not found", 404);
      return ok<PaymentOutDto>(
        res,
        "Payment retrieved",
        await withUser(payment),
      );
    } catch (error) {
      return fail(res, error, "Failed to load the payment");
    }
  };

  invoiceAny = async (req: Request, res: Response) => {
    try {
      const payment = await mongoPaymentStore.get(
        parseRouteId(req.params.paymentId),
      );
      if (!payment) throw new UserError("Invoice not found", 404);
      return sendPdf(res, await invoicePdfFor(payment));
    } catch (error) {
      return fail(res, error, "Could not make the invoice");
    }
  };

  /**
   * Midtrans' HTTP notification. Public: trusted only when its signature
   * matches our server key. Answers 200 for orders that are not ours so
   * Midtrans stops retrying them.
   */
  midtransNotification = async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as MidtransNotification;
    let outcome: Awaited<
      ReturnType<typeof paymentService.onMidtransNotification>
    >;
    try {
      outcome = await paymentService.onMidtransNotification(body);
    } catch (error) {
      logger.error(
        error instanceof Error ? error.message : String(error),
        logSource,
        "midtransNotification",
      );
      // 500 makes Midtrans retry later.
      return refuse(res, 500, "Could not process the notification");
    }
    switch (outcome) {
      case "not-set-up":
        return refuse(res, 404, "Midtrans is not set up");
      case "bad-signature":
        logger.warn(
          `Midtrans notification with a bad signature for ${String(body.order_id)}`,
          logSource,
          "midtransNotification",
        );
        return refuse(res, 403, "Invalid signature");
      case "unknown":
        logger.warn(
          `Midtrans notification for unknown order ${String(body.order_id)}`,
          logSource,
          "midtransNotification",
        );
        break;
      case "applied":
        break;
    }
    return ok(res, "OK", null);
  };
}
