import { Types } from "mongoose";
import type {
  BasketLinePatchInDto,
  CheckoutItemInDto,
  CheckoutQuoteOutDto,
} from "../../dto/payment.dto";
import { BASE_VARIANT_ID } from "../../models/product/product.interface";
import type { CheckoutPlacement } from "../../models/payment/payment.interface";
import type { VariantApplyMode } from "../../models/userProductPeriod/userProductPeriod.interface";
import { BasketModel } from "../../models/basket/basket.model";
import { clampQuantity, MAX_CHECKOUT_LINES } from "../payment/checkout.rules";
import { paymentService } from "../payment/payment.service";
import { productService } from "../product/product.service";
import { variantIdOf, variantOf } from "../product/product.variants";
import { userProductService } from "../userProduct/userProduct.service";

/** One basket line as the service works with it. */
interface Line {
  productId: string;
  quantity: number;
  variantId: string;
  applyVariant: VariantApplyMode;
  placement: CheckoutPlacement;
}

/**
 * Each signed-in user has one basket, kept on the server so it follows them
 * across devices. It is priced fresh every time it is read.
 */
export class BasketService {
  private async items(userId: string): Promise<Line[]> {
    const basket = await BasketModel.findOne({ userId }).lean().exec();
    return (basket?.items ?? []).map((item) => ({
      productId: item.productId.toString(),
      quantity: item.quantity,
      // Baskets saved before variants: the base one, applied by itself.
      variantId: item.variantId ?? BASE_VARIANT_ID,
      applyVariant: item.applyVariant ?? "auto",
      placement: item.placement ?? "after",
    }));
  }

  private async save(userId: string, items: Line[]): Promise<void> {
    await BasketModel.updateOne(
      { userId },
      {
        $set: {
          items: items.map((item) => ({
            productId: new Types.ObjectId(item.productId),
            quantity: item.quantity,
            variantId: item.variantId,
            applyVariant: item.applyVariant,
            placement: item.placement,
          })),
        },
      },
      { upsert: true },
    ).exec();
  }

  async get(userId: string): Promise<CheckoutQuoteOutDto> {
    const items = await this.items(userId);
    const quote = await paymentService.quote(userId, items);
    // Products removed for good drop out of the quote; forget them here too.
    if (quote.lines.length < items.length) {
      const kept = new Set(quote.lines.map((line) => line.product.id));
      await this.save(
        userId,
        items.filter((item) => kept.has(item.productId)),
      );
    }
    return quote;
  }

  /**
   * Add a product. A subscription already there on the same variant gets
   * more periods; on another variant, the line switches to this one with
   * this quantity, since one checkout buys one variant of a product.
   */
  async add(
    userId: string,
    input: CheckoutItemInDto,
  ): Promise<CheckoutQuoteOutDto> {
    const { productId, quantity } = input;
    const product = await productService.get(productId);
    if (product.deletedAt) {
      throw new Error("This product is no longer available");
    }
    // No variant named: extend the one the user is on, else the base.
    const variantId = variantIdOf(
      input.variantId ??
        (product.kind === "subscription"
          ? await userProductService.latestVariantOf(userId, productId)
          : null),
    );
    if (product.kind === "subscription" && !variantOf(product, variantId)) {
      throw new Error("This product has no such variant");
    }
    const applyVariant = input.applyVariant ?? "auto";
    const placement = input.placement ?? "after";
    const items = await this.items(userId);
    const existing = items.find((item) => item.productId === productId);
    if (existing) {
      existing.quantity = clampQuantity(
        product.kind,
        existing.variantId === variantId
          ? existing.quantity + quantity
          : quantity,
      );
      existing.variantId = variantId;
      existing.applyVariant = applyVariant;
      existing.placement = placement;
    } else {
      if (items.length >= MAX_CHECKOUT_LINES) {
        throw new Error(
          `A basket holds at most ${MAX_CHECKOUT_LINES} products`,
        );
      }
      items.push({
        productId,
        quantity: clampQuantity(product.kind, quantity),
        variantId,
        applyVariant,
        placement,
      });
    }
    await this.save(userId, items);
    return this.get(userId);
  }

  /** Change one line's quantity, variant, apply choice or placement. */
  async updateLine(
    userId: string,
    productId: string,
    patch: BasketLinePatchInDto,
  ): Promise<CheckoutQuoteOutDto> {
    const items = await this.items(userId);
    const existing = items.find((item) => item.productId === productId);
    if (!existing) throw new Error("This product is not in your basket");
    const product = await productService.get(productId);
    if (patch.quantity !== undefined) {
      existing.quantity = clampQuantity(product.kind, patch.quantity);
    }
    if (product.kind === "subscription") {
      if (patch.variantId !== undefined) {
        const variantId = variantIdOf(patch.variantId);
        if (!variantOf(product, variantId)) {
          throw new Error("This product has no such variant");
        }
        existing.variantId = variantId;
      }
      if (patch.applyVariant) existing.applyVariant = patch.applyVariant;
      if (patch.placement) existing.placement = patch.placement;
    }
    await this.save(userId, items);
    return this.get(userId);
  }

  async remove(
    userId: string,
    productIds: string[],
  ): Promise<CheckoutQuoteOutDto> {
    const items = await this.items(userId);
    await this.save(
      userId,
      items.filter((item) => !productIds.includes(item.productId)),
    );
    return this.get(userId);
  }

  async clear(userId: string): Promise<CheckoutQuoteOutDto> {
    await this.save(userId, []);
    return this.get(userId);
  }
}

export const basketService = new BasketService();
