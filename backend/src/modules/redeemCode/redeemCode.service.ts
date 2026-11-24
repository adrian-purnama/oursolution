import { randomInt } from "crypto";
import type { HydratedDocument } from "mongoose";
import type { PeriodEndSpec } from "../../dto/userProduct.dto";
import type {
  CreateRedeemCodesInDto,
  RedeemCodeGroup,
  RedeemCodeListOutDto,
  RedeemCodeOutDto,
  RedeemResultOutDto,
} from "../../dto/redeemCode.dto";
import { ProductModel } from "../../models/product/product.model";
import type { RedeemCodeInterface } from "../../models/redeemCode/redeemCode.interface";
import { RedeemCodeModel } from "../../models/redeemCode/redeemCode.model";
import { UserModel } from "../../models/user/user.model";
import { toProductSummary } from "../product/product.service";
import { variantIdOf, variantOf } from "../product/product.variants";
import {
  AlreadyOwnedError,
  purchaseService,
} from "../purchase/purchase.service";
import {
  PlanScheduleError,
  type AppendPlan,
} from "../userProduct/userProduct.planner";
import { userProductService } from "../userProduct/userProduct.service";
import { UserError } from "../../utils/userError";

/** No 0/O or 1/I/L, so a code read off paper is not mistyped. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const DAY_MS = 24 * 60 * 60 * 1000;

type RedeemCodeDoc = HydratedDocument<RedeemCodeInterface>;

/** A code that cannot be used: unknown, used, expired, or nothing to give. */
export class RedeemError extends UserError {
  constructor(message: string) {
    super(message, 409);
  }
}

function generateCode(): string {
  const chars = Array.from(
    { length: 12 },
    () => ALPHABET[randomInt(ALPHABET.length)],
  ).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === 11000
  );
}

/** Not redeemed and not past its last moment. */
function usableFilter(now: Date) {
  return {
    redeemedAt: null,
    $or: [{ validUntil: null }, { validUntil: { $gt: now } }],
  };
}

function groupFilter(group: RedeemCodeGroup, now: Date) {
  switch (group) {
    case "all":
      return {};
    case "available":
      return usableFilter(now);
    case "redeemed":
      return { redeemedAt: { $ne: null } };
    case "expired":
      return { redeemedAt: null, validUntil: { $ne: null, $lte: now } };
  }
}

function statusOf(doc: RedeemCodeDoc, now: Date): RedeemCodeOutDto["status"] {
  if (doc.redeemedAt) return "redeemed";
  if (doc.validUntil && doc.validUntil <= now) return "expired";
  return "available";
}

export class RedeemCodeService {
  /** Admin: make `quantity` codes for one product. */
  async create(
    input: CreateRedeemCodesInDto,
    actorId: string,
  ): Promise<RedeemCodeOutDto[]> {
    const product = await ProductModel.findById(input.productId).exec();
    if (!product) throw new Error("Product not found");
    if (product.deletedAt) throw new Error("This product has been deleted");

    if (product.kind === "oneTime") {
      if (input.activation !== "onRedeem") {
        throw new Error(
          "A one-time product is owned as soon as it is redeemed",
        );
      }
      if (input.durationDays !== null || input.endsAt) {
        throw new Error("A one-time product never ends");
      }
    } else if (input.durationDays === null && !input.endsAt) {
      throw new Error("Choose how long the subscription lasts");
    }
    if (product.kind === "oneTime" && input.variantId) {
      throw new Error("A one-time product has no variants");
    }
    const variant =
      product.kind === "subscription"
        ? variantOf(product, input.variantId)
        : null;
    if (product.kind === "subscription" && !variant) {
      throw new Error("The product has no such variant");
    }
    // Stored only when it is not the base, so old and new codes read alike.
    const fitted = {
      ...input,
      variantId: variant && !variant.isBase ? variant.id : null,
    };

    const created: RedeemCodeDoc[] = [];
    for (let i = 0; i < input.quantity; i += 1) {
      created.push(await this.createOne(fitted, actorId));
    }
    return this.toOut(created);
  }

  /** Admin: codes newest first, filtered by status. */
  async list(
    group: RedeemCodeGroup,
    page: number,
    pageSize: number,
    now: Date = new Date(),
  ): Promise<RedeemCodeListOutDto> {
    const [docs, all, available, redeemed, expired] = await Promise.all([
      RedeemCodeModel.find(groupFilter(group, now))
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec(),
      RedeemCodeModel.countDocuments(groupFilter("all", now)),
      RedeemCodeModel.countDocuments(groupFilter("available", now)),
      RedeemCodeModel.countDocuments(groupFilter("redeemed", now)),
      RedeemCodeModel.countDocuments(groupFilter("expired", now)),
    ]);
    const counts = { all, available, redeemed, expired };
    return {
      items: await this.toOut(docs, now),
      page,
      pageSize,
      total: counts[group],
      counts,
    };
  }

  /** Admin: remove a code nobody has redeemed. Redeemed ones stay on record. */
  async remove(id: string): Promise<void> {
    const deleted = await RedeemCodeModel.findOneAndDelete({
      _id: id,
      redeemedAt: null,
    }).exec();
    if (deleted) return;
    if (await RedeemCodeModel.exists({ _id: id })) {
      throw new Error("A redeemed code is kept on record");
    }
    throw new Error("Code not found");
  }

  /**
   * A user redeems a code for themselves. Gives the product the same way an
   * admin would: a one-time product is owned, a subscription gets a period.
   */
  async redeem(
    userId: string,
    code: string,
    now: Date = new Date(),
  ): Promise<RedeemResultOutDto> {
    const found = await RedeemCodeModel.findOne({ code }).exec();
    if (!found) throw new RedeemError("That code is not valid");
    if (found.redeemedAt) {
      throw new RedeemError("This code has already been redeemed");
    }
    if (found.validUntil && found.validUntil <= now) {
      throw new RedeemError("This code has expired");
    }

    const product = await ProductModel.findById(found.productId).exec();
    if (!product || product.deletedAt) {
      throw new RedeemError("This code's product is no longer available");
    }

    // Claim first, so two people redeeming at once cannot both get it.
    const claimed = await RedeemCodeModel.findOneAndUpdate(
      { _id: found._id, ...usableFilter(now) },
      { $set: { redeemedBy: userId, redeemedAt: now } },
      { new: true },
    ).exec();
    if (!claimed) {
      throw new RedeemError("This code has already been redeemed");
    }

    const origin = {
      source: "redeem" as const,
      redeemCodeId: claimed.id as string,
    };
    const productId = product.id as string;

    try {
      if (product.kind === "oneTime") {
        await purchaseService.grant(userId, productId, origin);
        return {
          product: toProductSummary(product),
          startsAt: now.toISOString(),
          endsAt: null,
        };
      }

      const plan = await this.planFor(claimed, userId, productId, now);
      if (!variantOf(product, claimed.variantId)) {
        throw new PlanScheduleError(
          "This code's variant is no longer available",
        );
      }
      const variant = {
        variantId: variantIdOf(claimed.variantId),
        applyVariant: "auto" as const,
      };
      if (claimed.activation === "date") {
        await userProductService.grantAt(
          userId,
          productId,
          plan,
          origin,
          now,
          variant,
        );
      } else {
        await userProductService.grant(
          userId,
          productId,
          plan,
          origin,
          variant,
        );
      }
      return {
        product: toProductSummary(product),
        startsAt: plan.startsAt.toISOString(),
        endsAt: plan.endsAt?.toISOString() ?? null,
      };
    } catch (error) {
      // Nothing was given: the code stays usable.
      await RedeemCodeModel.updateOne(
        { _id: claimed._id },
        { $set: { redeemedBy: null, redeemedAt: null } },
      );
      if (error instanceof AlreadyOwnedError) {
        throw new RedeemError(`You already own ${product.name}`);
      }
      if (error instanceof PlanScheduleError) {
        throw new RedeemError(error.message);
      }
      throw error;
    }
  }

  /**
   * "onRedeem" queues after the product's schedule (starting now when there
   * is none); "date" starts on its date, or now once that has passed.
   */
  private async planFor(
    doc: RedeemCodeDoc,
    userId: string,
    productId: string,
    now: Date,
  ): Promise<AppendPlan> {
    const end: PeriodEndSpec =
      doc.durationDays !== null
        ? { kind: "days", days: doc.durationDays }
        : doc.endsAt
          ? { kind: "date", at: doc.endsAt }
          : { kind: "none" };

    if (doc.activation !== "date" || !doc.activatesAt) {
      return userProductService.planAppendFor(userId, productId, end, now);
    }

    const startsAt = doc.activatesAt > now ? doc.activatesAt : now;
    const endsAt =
      end.kind === "days"
        ? new Date(startsAt.getTime() + end.days * DAY_MS)
        : end.kind === "date"
          ? end.at
          : null;
    if (endsAt && endsAt <= startsAt) {
      throw new PlanScheduleError("This code's period has already ended");
    }
    return { startsAt, endsAt };
  }

  private async createOne(
    input: CreateRedeemCodesInDto,
    actorId: string,
  ): Promise<RedeemCodeDoc> {
    // 31^12 codes: a clash is near impossible, but retry rather than fail.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await RedeemCodeModel.create({
          code: generateCode(),
          productId: input.productId,
          variantId: input.variantId,
          activation: input.activation,
          activatesAt: input.activatesAt,
          durationDays: input.durationDays,
          endsAt: input.endsAt,
          validUntil: input.validUntil,
          createdBy: actorId,
        });
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
      }
    }
    throw new Error("Could not make a unique code, please try again");
  }

  private async toOut(
    docs: RedeemCodeDoc[],
    now: Date = new Date(),
  ): Promise<RedeemCodeOutDto[]> {
    const productIds = [
      ...new Set(docs.map((doc) => doc.productId.toString())),
    ];
    const userIds = [
      ...new Set(
        docs.flatMap((doc) => [
          doc.createdBy.toString(),
          ...(doc.redeemedBy ? [doc.redeemedBy.toString()] : []),
        ]),
      ),
    ];
    const [products, users] = await Promise.all([
      ProductModel.find({ _id: { $in: productIds } }).exec(),
      UserModel.find({ _id: { $in: userIds } }, { email: 1 }).exec(),
    ]);
    const productById = new Map(
      products.map((product) => [product.id as string, product]),
    );
    const emailById = new Map(
      users.map((user) => [user.id as string, user.email]),
    );
    const userOut = (id: string | undefined) =>
      id ? { id, email: emailById.get(id) ?? "Deleted user" } : null;

    return docs.map((doc) => {
      const product = productById.get(doc.productId.toString());
      return {
        id: doc.id as string,
        code: doc.code,
        product: product ? toProductSummary(product) : null,
        variant:
          product && doc.variantId
            ? {
                id: doc.variantId,
                name: variantOf(product, doc.variantId)?.name ?? doc.variantId,
              }
            : null,
        activation: doc.activation,
        activatesAt: doc.activatesAt?.toISOString() ?? null,
        durationDays: doc.durationDays,
        endsAt: doc.endsAt?.toISOString() ?? null,
        validUntil: doc.validUntil?.toISOString() ?? null,
        status: statusOf(doc, now),
        createdAt: (doc.createdAt ?? now).toISOString(),
        createdBy: userOut(doc.createdBy.toString()),
        redeemedAt: doc.redeemedAt?.toISOString() ?? null,
        redeemedBy: userOut(doc.redeemedBy?.toString()),
      };
    });
  }
}

export const redeemCodeService = new RedeemCodeService();
