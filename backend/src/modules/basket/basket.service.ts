import { Types } from "mongoose";
import type { CheckoutQuoteOutDto } from "../../dto/payment.dto";
import { BasketModel } from "../../models/basket/basket.model";
import { clampQuantity, MAX_CHECKOUT_LINES } from "../payment/checkout.rules";
import { paymentService } from "../payment/payment.service";
import { productService } from "../product/product.service";

/**
 * Each signed-in user has one basket, kept on the server so it follows them
 * across devices. It is priced fresh every time it is read.
 */
export class BasketService {
  private async items(
    userId: string,
  ): Promise<{ productId: string; quantity: number }[]> {
    const basket = await BasketModel.findOne({ userId }).lean().exec();
    return (basket?.items ?? []).map((item) => ({
      productId: item.productId.toString(),
      quantity: item.quantity,
    }));
  }

  private async save(
    userId: string,
    items: { productId: string; quantity: number }[],
  ): Promise<void> {
    await BasketModel.updateOne(
      { userId },
      {
        $set: {
          items: items.map((item) => ({
            productId: new Types.ObjectId(item.productId),
            quantity: item.quantity,
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

  /** Add a product; a subscription already there gets more periods. */
  async add(
    userId: string,
    productId: string,
    quantity: number,
  ): Promise<CheckoutQuoteOutDto> {
    const product = await productService.get(productId);
    if (product.deletedAt) {
      throw new Error("This product is no longer available");
    }
    const items = await this.items(userId);
    const existing = items.find((item) => item.productId === productId);
    if (existing) {
      existing.quantity = clampQuantity(
        product.kind,
        existing.quantity + quantity,
      );
    } else {
      if (items.length >= MAX_CHECKOUT_LINES) {
        throw new Error(
          `A basket holds at most ${MAX_CHECKOUT_LINES} products`,
        );
      }
      items.push({
        productId,
        quantity: clampQuantity(product.kind, quantity),
      });
    }
    await this.save(userId, items);
    return this.get(userId);
  }

  async setQuantity(
    userId: string,
    productId: string,
    quantity: number,
  ): Promise<CheckoutQuoteOutDto> {
    const items = await this.items(userId);
    const existing = items.find((item) => item.productId === productId);
    if (!existing) throw new Error("This product is not in your basket");
    const product = await productService.get(productId);
    existing.quantity = clampQuantity(product.kind, quantity);
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
