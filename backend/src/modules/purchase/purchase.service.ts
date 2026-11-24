import { Types } from "mongoose";
import type { PurchaseOutDto } from "../../dto/purchase.dto";
import { ProductModel } from "../../models/product/product.model";
import { PurchaseModel } from "../../models/purchase/purchase.model";
import { UserModel } from "../../models/user/user.model";
import { toProductSummary } from "../product/product.service";
import { UserError } from "../../utils/userError";

export class AlreadyOwnedError extends UserError {
  constructor(message: string) {
    super(message, 409);
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === 11000
  );
}

/** One-time products a user owns. They never expire. */
export class PurchaseService {
  async listOwned(userId: string): Promise<PurchaseOutDto[]> {
    const purchases = await PurchaseModel.find({ userId })
      .sort({ createdAt: -1 })
      .exec();
    const products = await ProductModel.find({
      _id: { $in: purchases.map((purchase) => purchase.productId) },
    }).exec();
    const byId = new Map(
      products.map((product) => [product.id as string, product]),
    );

    return purchases.flatMap((purchase) => {
      const product = byId.get(purchase.productId.toString());
      if (!product) return [];
      return [
        {
          purchaseId: purchase.id as string,
          product: toProductSummary(product),
          accessUrl: product.accessUrl,
          purchasedAt: (purchase.createdAt ?? new Date()).toISOString(),
          source: purchase.source,
        },
      ];
    });
  }

  async owns(userId: string, productId: string): Promise<boolean> {
    return Boolean(await PurchaseModel.exists({ userId, productId }));
  }

  /** Ids of every one-time product the user owns. */
  async ownedProductIds(userId: string): Promise<Types.ObjectId[]> {
    return PurchaseModel.distinct("productId", { userId }).exec();
  }

  /** Record that the user owns the product. Throws AlreadyOwnedError if they do. */
  async grant(
    userId: string,
    productId: string,
    origin:
      | { source: "admin"; grantedBy: string }
      | { source: "checkout"; paymentId: string }
      | { source: "redeem"; redeemCodeId: string },
  ): Promise<string> {
    try {
      const created = await PurchaseModel.create({
        userId,
        productId,
        source: origin.source,
        ...(origin.source === "admin"
          ? { grantedBy: new Types.ObjectId(origin.grantedBy) }
          : origin.source === "checkout"
            ? { paymentId: new Types.ObjectId(origin.paymentId) }
            : { redeemCodeId: new Types.ObjectId(origin.redeemCodeId) }),
      });
      return created.id as string;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new AlreadyOwnedError("The user already owns this product");
      }
      throw error;
    }
  }

  /** Admin: give a user a one-time product without a payment. */
  async grantByAdmin(
    userId: string,
    productId: string,
    actorId: string,
  ): Promise<PurchaseOutDto[]> {
    if (!(await UserModel.exists({ _id: userId }))) {
      throw new Error("User not found");
    }
    await this.requireOneTime(productId);
    await this.grant(userId, productId, {
      source: "admin",
      grantedBy: actorId,
    });
    return this.listOwned(userId);
  }

  /** Admin: take a one-time product back. Any payment for it stays on record. */
  async revoke(userId: string, purchaseId: string): Promise<PurchaseOutDto[]> {
    const deleted = await PurchaseModel.findOneAndDelete({
      _id: purchaseId,
      userId,
    }).exec();
    if (!deleted) throw new Error("Purchase not found");
    return this.listOwned(userId);
  }

  async requireOneTime(productId: string): Promise<void> {
    const product = await ProductModel.findById(productId).exec();
    if (!product) throw new Error("Product not found");
    if (product.deletedAt) throw new Error("This product has been deleted");
    if (product.kind !== "oneTime") {
      throw new Error(
        "That product is a subscription; set it on the user's plan instead",
      );
    }
  }
}

export const purchaseService = new PurchaseService();
