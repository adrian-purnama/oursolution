import type { Request, Response } from "express";
import { ApiResponseDto } from "../../dto/apiResponse.dto";
import type {
  AdminPaymentListOutDto,
  CheckoutOutDto,
  CheckoutQuoteOutDto,
  PaymentConfigOutDto,
  PaymentListOutDto,
  PaymentOutDto,
} from "../../dto/payment.dto";
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
import { AlreadyOwnedError } from "../purchase/purchase.service";
import { PlanScheduleError } from "../userProduct/userProduct.planner";
import { MidtransProvider, midtransStatus } from "./midtrans.provider";
import { notifyInvoiceIssued, invoicePdfFor } from "./payment.invoice";
import {
  CheckoutError,
  listAllPayments,
  listPayments,
  mongoPaymentStore,
  PAYMENT_GROUPS,
  type PaymentGroup,
  paymentProvider,
  paymentService,
  toPaymentOut,
  type PaymentRecord,
} from "./payment.service";

const logSource = "modules/payment/payment.controller.ts";

function statusOf(error: unknown): number {
  if (
    error instanceof CheckoutError ||
    error instanceof PlanScheduleError ||
    error instanceof AlreadyOwnedError
  ) {
    return 409;
  }
  if (error instanceof Error && error.message === "Invoice not found") {
    return 404;
  }
  return 400;
}

function fail(res: Response, error: unknown, fallback: string) {
  return res.status(statusOf(error)).json({
    success: false,
    message: error instanceof Error ? error.message : fallback,
    data: null,
  } satisfies ApiResponseDto);
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
    return res.status(200).json({
      success: true,
      message: "Payment config",
      data: { provider: paymentProvider?.name ?? null, snap },
    } satisfies ApiResponseDto<PaymentConfigOutDto>);
  };

  quote = async (req: Request, res: Response) => {
    try {
      const { items } = parseCheckoutQuoteInDto(req.body);
      const data = await paymentService.quote(req.user!.id, items);
      return res.status(200).json({
        success: true,
        message: "Checkout priced",
        data,
      } satisfies ApiResponseDto<CheckoutQuoteOutDto>);
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
      return res.status(200).json({
        success: true,
        message:
          data.status === "paid" ? "Payment received" : "Payment started",
        data,
      } satisfies ApiResponseDto<CheckoutOutDto>);
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
      return res.status(200).json({
        success: true,
        message: "Payments retrieved",
        data,
      } satisfies ApiResponseDto<PaymentListOutDto>);
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
      return res.status(200).json({
        success: true,
        message: "Payment retrieved",
        data: toPaymentOut(payment),
      } satisfies ApiResponseDto<PaymentOutDto>);
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
      return res.status(200).json({
        success: true,
        message: "Invoice cancelled",
        data,
      } satisfies ApiResponseDto<PaymentOutDto>);
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
      return res.status(200).json({
        success: true,
        message: "Payments retrieved",
        data,
      } satisfies ApiResponseDto<PaymentListOutDto>);
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
      return res.status(200).json({
        success: true,
        message: "Payments retrieved",
        data,
      } satisfies ApiResponseDto<AdminPaymentListOutDto>);
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
      if (!payment) throw new Error("Invoice not found");
      if (input.notify && payment.status === "pending") {
        void notifyInvoiceIssued(payment.id).catch((error: unknown) =>
          logger.error(
            `Could not send invoice ${payment.invoiceNumber}: ${error instanceof Error ? error.message : String(error)}`,
            logSource,
            "createForUser",
          ),
        );
      }
      return res.status(201).json({
        success: true,
        message:
          payment.status === "paid"
            ? `Invoice ${payment.invoiceNumber} made and marked paid`
            : `Invoice ${payment.invoiceNumber} sent`,
        data: await withUser(payment),
      } satisfies ApiResponseDto<PaymentOutDto>);
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
      if (!payment) throw new Error("Invoice not found");
      return res.status(200).json({
        success: true,
        message: "Payment retrieved",
        data: await withUser(payment),
      } satisfies ApiResponseDto<PaymentOutDto>);
    } catch (error) {
      return fail(res, error, "Failed to load the payment");
    }
  };

  invoiceAny = async (req: Request, res: Response) => {
    try {
      const payment = await mongoPaymentStore.get(
        parseRouteId(req.params.paymentId),
      );
      if (!payment) throw new Error("Invoice not found");
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
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!(paymentProvider instanceof MidtransProvider)) {
      return res.status(404).json({
        success: false,
        message: "Midtrans is not set up",
        data: null,
      } satisfies ApiResponseDto);
    }
    if (!paymentProvider.verifySignature(body)) {
      logger.warn(
        `Midtrans notification with a bad signature for ${String(body.order_id)}`,
        logSource,
        "midtransNotification",
      );
      return res.status(403).json({
        success: false,
        message: "Invalid signature",
        data: null,
      } satisfies ApiResponseDto);
    }
    try {
      const orderId = String(body.order_id);
      const payment = await mongoPaymentStore.get(orderId);
      if (payment && payment.provider === "midtrans") {
        await paymentService.applyProviderStatus(
          payment.id,
          midtransStatus(body),
          "notification",
        );
      } else {
        logger.warn(
          `Midtrans notification for unknown order ${orderId}`,
          logSource,
          "midtransNotification",
        );
      }
      return res.status(200).json({
        success: true,
        message: "OK",
        data: null,
      } satisfies ApiResponseDto);
    } catch (error) {
      logger.error(
        error instanceof Error ? error.message : String(error),
        logSource,
        "midtransNotification",
      );
      // 500 makes Midtrans retry later.
      return res.status(500).json({
        success: false,
        message: "Could not process the notification",
        data: null,
      } satisfies ApiResponseDto);
    }
  };
}
