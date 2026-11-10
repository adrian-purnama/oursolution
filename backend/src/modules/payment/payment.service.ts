import type { CheckoutOutDto } from "../../dto/payment.dto";
import type { PeriodEndSpec } from "../../dto/userProduct.dto";
import { logger } from "../../logger/logger";
import { PaymentModel } from "../../models/payment/payment.model";
import { productService } from "../product/product.service";
import {
  AlreadyOwnedError,
  purchaseService,
} from "../purchase/purchase.service";
import { userProductService } from "../userProduct/userProduct.service";
import { allowAllProvider, type PaymentProvider } from "./payment.provider";

const logSource = "modules/payment/payment.service.ts";

type Deps = {
  provider: PaymentProvider;
  products: Pick<typeof productService, "get">;
  userProducts: Pick<typeof userProductService, "planAppendFor" | "grant">;
  purchases: Pick<typeof purchaseService, "owns" | "grant">;
  payments: Pick<typeof PaymentModel, "create" | "updateOne">;
};

/**
 * Checkout: a user buys one product.
 * - A subscription adds its duration after whatever the user already has of
 *   it, so buying again extends access instead of overlapping it.
 * - A one-time product is owned for good once paid, and can be bought once.
 */
export class PaymentService {
  constructor(private readonly deps: Deps) {}

  async checkout(
    userId: string,
    productId: string,
    now: Date = new Date(),
  ): Promise<CheckoutOutDto> {
    const { provider, products, userProducts, purchases, payments } = this.deps;

    const product = await products.get(productId);
    if (!product.showOnPricingPage) {
      throw new Error("This product is not available for checkout");
    }

    // Check the product can be granted before charging, so nobody pays for
    // something they cannot get.
    let end: PeriodEndSpec | null = null;
    if (product.kind === "subscription") {
      if (!product.durationDays) {
        throw new Error("This subscription has no duration set");
      }
      end = { kind: "days", days: product.durationDays };
      await userProducts.planAppendFor(userId, productId, end, now);
    } else if (await purchases.owns(userId, productId)) {
      throw new AlreadyOwnedError("You already own this product");
    }

    const payment = await payments.create({
      userId,
      productId,
      amountIdr: product.priceIdr,
      durationDays:
        product.kind === "subscription" ? product.durationDays : null,
      status: "pending",
      provider: provider.name,
    });
    const paymentId = payment.id as string;

    const result = await provider.charge({
      paymentId,
      userId,
      productId,
      amountIdr: product.priceIdr,
      description:
        product.kind === "subscription"
          ? `${product.name}, ${product.durationDays} days`
          : product.name,
    });

    if (result.status === "failed") {
      await payments.updateOne(
        { _id: paymentId },
        { $set: { status: "failed", failureReason: result.reason } },
      );
      throw new Error(`Payment failed: ${result.reason}`);
    }

    if (result.status === "pending") {
      await payments.updateOne(
        { _id: paymentId },
        { $set: { reference: result.reference } },
      );
      return { paymentId, status: "pending", redirectUrl: result.redirectUrl };
    }

    // Paid: grant what was bought.
    let granted: { periodId: string } | { purchaseId: string };
    if (end) {
      // Plan again from the current state: time may have passed while charging.
      const plan = await userProducts.planAppendFor(userId, productId, end);
      granted = {
        periodId: await userProducts.grant(userId, productId, plan, {
          source: "checkout",
          paymentId,
        }),
      };
    } else {
      granted = {
        purchaseId: await purchases.grant(userId, productId, {
          source: "checkout",
          paymentId,
        }),
      };
    }

    await payments.updateOne(
      { _id: paymentId },
      { $set: { status: "paid", reference: result.reference, ...granted } },
    );
    logger.info(
      `Checkout ${paymentId} paid via ${provider.name}`,
      logSource,
      "checkout",
    );

    return { paymentId, status: "paid", redirectUrl: null };
  }
}

export const paymentService = new PaymentService({
  provider: allowAllProvider,
  products: productService,
  userProducts: userProductService,
  purchases: purchaseService,
  payments: PaymentModel,
});
