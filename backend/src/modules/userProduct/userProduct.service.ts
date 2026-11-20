import mongoose, { Types, type HydratedDocument } from "mongoose";
import type { ProductSummaryDto } from "../../dto/product.dto";
import type {
  AssignProductDto,
  ProductPeriodOutDto,
  UserPlanOutDto,
  UserProductRowOutDto,
} from "../../dto/userProduct.dto";
import { BASE_VARIANT_ID } from "../../models/product/product.interface";
import { ProductModel } from "../../models/product/product.model";
import { PurchaseModel } from "../../models/purchase/purchase.model";
import { UserModel } from "../../models/user/user.model";
import type {
  ProductPeriodSource,
  UserProductPeriodInterface,
  VariantApplyMode,
} from "../../models/userProductPeriod/userProductPeriod.interface";
import { UserProductPeriodModel } from "../../models/userProductPeriod/userProductPeriod.model";
import { toProductSummary } from "../product/product.service";
import {
  dailyPriceIdr,
  variantIdOf,
  variantOf,
  type VariantHost,
} from "../product/product.variants";
import { purchaseService } from "../purchase/purchase.service";
import {
  assertDeletable,
  assertFree,
  planAppend,
  planEndNow,
  planOverride,
  planSwitch,
  PlanScheduleError,
  variantChange,
  type AppendPlan,
  type PeriodLike,
  type SwitchPlan,
} from "./userProduct.planner";

/** Where a period came from. */
export type PeriodOrigin =
  | { source: Extract<ProductPeriodSource, "admin">; createdBy: string }
  | { source: Extract<ProductPeriodSource, "checkout">; paymentId: string }
  | { source: Extract<ProductPeriodSource, "redeem">; redeemCodeId: string };

function originFields(origin: PeriodOrigin) {
  if (origin.source === "admin") {
    return { createdBy: new Types.ObjectId(origin.createdBy) };
  }
  if (origin.source === "checkout") {
    return { paymentId: new Types.ObjectId(origin.paymentId) };
  }
  return { redeemCodeId: new Types.ObjectId(origin.redeemCodeId) };
}

/** Which variant a new period pays for, and how it is applied. */
export interface PeriodVariant {
  variantId: string;
  applyVariant: VariantApplyMode;
}

const DEFAULT_PERIOD_VARIANT: PeriodVariant = {
  variantId: BASE_VARIANT_ID,
  applyVariant: "auto",
};

/** `planSwitch` for these stored periods, priced on the product's variants. */
function switchPlanOf(
  product: VariantHost,
  periods: PeriodDoc[],
  variantId: string,
  purchasedDays: number,
  now: Date,
): SwitchPlan {
  const target = variantOf(product, variantId);
  if (!target) throw new PlanScheduleError("The product has no such variant");
  return planSwitch(
    periods.map((doc) => ({
      ...toPeriodLike(doc),
      variantId: variantIdOf(doc.variantId),
    })),
    now,
    (id) => {
      const variant = variantOf(product, id);
      return variant ? dailyPriceIdr(variant) : null;
    },
    dailyPriceIdr(target),
    purchasedDays,
  );
}

/** See `UserProductService.variantSchedule`. */
export interface VariantSchedule {
  current: { variantId: string; applyVariant: VariantApplyMode } | null;
  next: { variantId: string; startsAt: Date } | null;
}

/** Finished periods shown per user, newest kept. */
const HISTORY_LIMIT = 50;

type PeriodDoc = HydratedDocument<UserProductPeriodInterface>;

function toPeriodLike(doc: PeriodDoc): PeriodLike {
  return { id: doc.id, startsAt: doc.startsAt, endsAt: doc.endsAt };
}

function toPeriodOut(doc: PeriodDoc, now: Date): ProductPeriodOutDto {
  return {
    periodId: doc.id,
    startsAt: doc.startsAt.toISOString(),
    endsAt: doc.endsAt?.toISOString() ?? null,
    isCurrent: doc.startsAt <= now && (doc.endsAt === null || doc.endsAt > now),
    source: doc.source,
    variantId: variantIdOf(doc.variantId),
  };
}

/** Running or scheduled at `now`. */
function liveFilter(now: Date) {
  return { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] };
}

export class UserProductService {
  /**
   * What a user can use at `now`: running subscriptions plus owned one-time
   * products. Gate features on this, for admins too.
   */
  async getActiveProducts(
    userId: string,
    now: Date = new Date(),
  ): Promise<ProductSummaryDto[]> {
    const [subscribed, owned] = await Promise.all([
      UserProductPeriodModel.distinct("productId", {
        userId,
        startsAt: { $lte: now },
        ...liveFilter(now),
      }).exec(),
      purchaseService.ownedProductIds(userId),
    ]);
    const productIds = [...subscribed, ...owned];
    if (productIds.length === 0) return [];

    const products = await ProductModel.find({ _id: { $in: productIds } })
      .sort({ name: 1 })
      .exec();
    return products.map(toProductSummary);
  }

  /** True when the user has this subscription running or scheduled. */
  async hasLivePeriod(
    userId: string,
    productId: string,
    now: Date = new Date(),
  ): Promise<boolean> {
    const found = await UserProductPeriodModel.exists({
      userId,
      productId,
      ...liveFilter(now),
    });
    return Boolean(found);
  }

  /** True while a subscription runs, or once a one-time product is owned. */
  async hasActiveProduct(
    userId: string,
    productId: string,
    now: Date = new Date(),
  ): Promise<boolean> {
    const [running, owned] = await Promise.all([
      UserProductPeriodModel.exists({
        userId,
        productId,
        startsAt: { $lte: now },
        ...liveFilter(now),
      }),
      purchaseService.owns(userId, productId),
    ]);
    return Boolean(running) || owned;
  }

  /**
   * When the subscription that runs at `now` ends, counting periods that
   * follow on without a gap: a date, null when it has no end, undefined
   * when it is not running.
   */
  async runsUntil(
    userId: string,
    productId: string,
    now: Date = new Date(),
  ): Promise<Date | null | undefined> {
    const periods = await UserProductPeriodModel.find({
      userId,
      productId,
      ...liveFilter(now),
    })
      .sort({ startsAt: 1 })
      .exec();
    if (periods.length === 0 || periods[0].startsAt > now) return undefined;
    let end = periods[0].endsAt;
    for (const period of periods.slice(1)) {
      if (end === null || period.startsAt > end) break;
      end = period.endsAt;
    }
    return end;
  }

  /**
   * Which variant the subscription is on at `now`, how a change to it is
   * applied, and the next scheduled period on another variant. Periods
   * saved before variants existed are on the base one.
   */
  async variantSchedule(
    userId: string,
    productId: string,
    now: Date = new Date(),
  ): Promise<VariantSchedule> {
    const periods = await this.loadLive(userId, productId, now);
    const { current, next } = variantChange(
      periods.map((doc) => ({
        ...toPeriodLike(doc),
        variantId: variantIdOf(doc.variantId),
        applyVariant: doc.applyVariant ?? "auto",
      })),
      now,
    );
    return {
      current: current
        ? { variantId: current.variantId, applyVariant: current.applyVariant }
        : null,
      next: next
        ? { variantId: next.variantId, startsAt: next.startsAt }
        : null,
    };
  }

  /** The user's plan: one row per product with its recent, running and scheduled periods. */
  async getPlan(
    userId: string,
    now: Date = new Date(),
  ): Promise<UserPlanOutDto> {
    await this.requireUser(userId);

    const [liveDocs, pastDocs, purchases] = await Promise.all([
      UserProductPeriodModel.find({ userId, ...liveFilter(now) }).exec(),
      UserProductPeriodModel.find({ userId, endsAt: { $ne: null, $lte: now } })
        .sort({ endsAt: -1 })
        .limit(HISTORY_LIMIT)
        .exec(),
      PurchaseModel.find({ userId }).exec(),
    ]);
    const docs = [...pastDocs, ...liveDocs];

    const byProduct = new Map<string, PeriodDoc[]>();
    for (const doc of docs) {
      const key = doc.productId.toString();
      byProduct.set(key, [...(byProduct.get(key) ?? []), doc]);
    }

    // A one-time product is owned for good: one period from the purchase, no end.
    const owned = new Map<string, ProductPeriodOutDto>(
      purchases.map((purchase) => [
        purchase.productId.toString(),
        {
          periodId: purchase.id as string,
          startsAt: (purchase.createdAt ?? now).toISOString(),
          endsAt: null,
          isCurrent: true,
          source: purchase.source,
          variantId: BASE_VARIANT_ID,
        },
      ]),
    );

    const products = await ProductModel.find({
      _id: { $in: [...byProduct.keys(), ...owned.keys()] },
    }).exec();

    const rows: UserProductRowOutDto[] = products.map((product) => {
      const purchase = owned.get(product.id as string);
      const periods = purchase
        ? [purchase]
        : (byProduct.get(product.id as string) ?? [])
            .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
            .map((doc) => toPeriodOut(doc, now));
      return {
        product: toProductSummary(product),
        active: periods.some((period) => period.isCurrent),
        periods,
      };
    });

    rows.sort(
      (a, b) =>
        Number(b.active) - Number(a.active) ||
        a.product.name.localeCompare(b.product.name),
    );

    return { now: now.toISOString(), rows };
  }

  /** Start a product now, cutting short its running period if there is one. */
  async overrideNow(
    userId: string,
    input: AssignProductDto,
    actorId: string,
    now: Date = new Date(),
  ): Promise<UserPlanOutDto> {
    await this.requireUser(userId);
    const variantId = await this.requireVariant(
      input.productId,
      input.variantId,
    );

    const periods = await this.loadLive(userId, input.productId, now);
    const plan = planOverride(periods.map(toPeriodLike), now, input.end);

    await mongoose.connection.transaction(async (session) => {
      if (plan.truncateId) {
        await UserProductPeriodModel.updateOne(
          { _id: plan.truncateId },
          { $set: { endsAt: plan.startsAt } },
          { session },
        );
      }
      await UserProductPeriodModel.create(
        [
          {
            userId,
            productId: input.productId,
            startsAt: plan.startsAt,
            endsAt: plan.endsAt,
            variantId,
            applyVariant: "auto",
            source: "admin",
            createdBy: new Types.ObjectId(actorId),
          },
        ],
        { session },
      );
    });

    return this.getPlan(userId);
  }

  /** Queue a product period after everything already scheduled for it. */
  async scheduleNext(
    userId: string,
    input: AssignProductDto,
    actorId: string,
    now: Date = new Date(),
  ): Promise<UserPlanOutDto> {
    await this.requireUser(userId);
    const variantId = await this.requireVariant(
      input.productId,
      input.variantId,
    );

    const plan = await this.planAppendFor(
      userId,
      input.productId,
      input.end,
      now,
    );
    await this.grant(
      userId,
      input.productId,
      plan,
      { source: "admin", createdBy: actorId },
      { variantId, applyVariant: "auto" },
    );

    return this.getPlan(userId);
  }

  /** Stop a product right now. Scheduled periods of it are kept. */
  async endNow(
    userId: string,
    productId: string,
    now: Date = new Date(),
  ): Promise<UserPlanOutDto> {
    await this.requireUser(userId);
    const periods = await this.loadLive(userId, productId, now);
    const periodId = planEndNow(periods.map(toPeriodLike), now);

    await UserProductPeriodModel.updateOne(
      { _id: periodId },
      { $set: { endsAt: now } },
    );
    return this.getPlan(userId);
  }

  /**
   * Remove a running or scheduled period; the product is inactive for that
   * time. Any payment for it stays on record.
   */
  async deletePeriod(
    userId: string,
    periodId: string,
    now: Date = new Date(),
  ): Promise<UserPlanOutDto> {
    const period = await UserProductPeriodModel.findOne({
      _id: periodId,
      userId,
    }).exec();
    if (!period) throw new Error("Period not found");

    assertDeletable(toPeriodLike(period), now);
    await period.deleteOne();

    return this.getPlan(userId);
  }

  /** Where a new period for this product would go if queued now. Throws when it cannot. */
  async planAppendFor(
    userId: string,
    productId: string,
    end: AssignProductDto["end"],
    now: Date = new Date(),
  ): Promise<AppendPlan> {
    const periods = await this.loadLive(userId, productId, now);
    return planAppend(periods.map(toPeriodLike), now, end);
  }

  /**
   * The variant of the user's last running or scheduled period of this
   * product: what buying more without naming a variant extends. Null when
   * they have none.
   */
  async latestVariantOf(
    userId: string,
    productId: string,
    now: Date = new Date(),
  ): Promise<string | null> {
    const last = (await this.loadLive(userId, productId, now)).at(-1);
    return last ? variantIdOf(last.variantId) : null;
  }

  /**
   * What switching this product to `variantId` now would do, buying
   * `purchasedDays` of it. Throws a PlanScheduleError when it cannot.
   */
  async planSwitchFor(
    userId: string,
    product: VariantHost & { id: string },
    variantId: string,
    purchasedDays: number,
    now: Date = new Date(),
  ): Promise<SwitchPlan> {
    const periods = await this.loadLive(userId, product.id, now);
    return switchPlanOf(product, periods, variantId, purchasedDays, now);
  }

  /**
   * Switch the product to another variant now (see `planSwitch`), worked
   * out afresh and stored in one transaction. Returns the new period's id.
   */
  async switchNow(
    userId: string,
    product: VariantHost & { id: string },
    purchasedDays: number,
    origin: PeriodOrigin,
    variant: PeriodVariant,
    now: Date = new Date(),
  ): Promise<string> {
    let createdId = "";
    await mongoose.connection.transaction(async (session) => {
      const periods = await UserProductPeriodModel.find({
        userId,
        productId: product.id,
        ...liveFilter(now),
      })
        .sort({ startsAt: 1 })
        .session(session)
        .exec();
      const plan = switchPlanOf(
        product,
        periods,
        variant.variantId,
        purchasedDays,
        now,
      );
      if (plan.truncateId) {
        await UserProductPeriodModel.updateOne(
          { _id: plan.truncateId },
          { $set: { endsAt: plan.startsAt } },
          { session },
        );
      }
      if (plan.deleteIds.length > 0) {
        await UserProductPeriodModel.deleteMany(
          { _id: { $in: plan.deleteIds } },
          { session },
        );
      }
      const [created] = await UserProductPeriodModel.create(
        [
          {
            userId,
            productId: product.id,
            startsAt: plan.startsAt,
            endsAt: plan.endsAt,
            variantId: variant.variantId,
            applyVariant: variant.applyVariant,
            source: origin.source,
            ...originFields(origin),
          },
        ],
        { session },
      );
      createdId = created.id as string;
    });
    return createdId;
  }

  /**
   * Store a period worked out by `planAppendFor`, on `variant` (default:
   * the base one, applied by itself).
   */
  async grant(
    userId: string,
    productId: string,
    plan: AppendPlan,
    origin: PeriodOrigin,
    variant: PeriodVariant = DEFAULT_PERIOD_VARIANT,
  ): Promise<string> {
    const created = await UserProductPeriodModel.create({
      userId,
      productId,
      startsAt: plan.startsAt,
      endsAt: plan.endsAt,
      variantId: variant.variantId,
      applyVariant: variant.applyVariant,
      source: origin.source,
      ...originFields(origin),
    });
    return created.id as string;
  }

  /**
   * Store a period at fixed times. Throws a PlanScheduleError when it would
   * overlap a running or scheduled period of the same product.
   */
  async grantAt(
    userId: string,
    productId: string,
    plan: AppendPlan,
    origin: PeriodOrigin,
    now: Date = new Date(),
    variant: PeriodVariant = DEFAULT_PERIOD_VARIANT,
  ): Promise<string> {
    const periods = await this.loadLive(userId, productId, now);
    assertFree(periods.map(toPeriodLike), plan);
    return this.grant(userId, productId, plan, origin, variant);
  }

  /** Running or scheduled periods of one product for one user, earliest first. */
  private async loadLive(
    userId: string,
    productId: string,
    now: Date,
  ): Promise<PeriodDoc[]> {
    return UserProductPeriodModel.find({
      userId,
      productId,
      ...liveFilter(now),
    })
      .sort({ startsAt: 1 })
      .exec();
  }

  private async requireUser(userId: string): Promise<void> {
    const exists = await UserModel.exists({ _id: userId });
    if (!exists) throw new Error("User not found");
  }

  /** Only subscriptions live on the plan timeline. */
  /** `requireProduct`, then the variant's id (null: the base one). */
  private async requireVariant(
    productId: string,
    variantId: string | null,
  ): Promise<string> {
    await this.requireProduct(productId);
    const product = await ProductModel.findById(productId).exec();
    const variant = product ? variantOf(product, variantId) : null;
    if (!variant) throw new Error("The product has no such variant");
    return variant.id;
  }

  private async requireProduct(productId: string): Promise<void> {
    const product = await ProductModel.findById(productId).exec();
    if (!product) throw new Error("Product not found");
    if (product.deletedAt) throw new Error("This product has been deleted");
    if (product.kind !== "subscription") {
      throw new Error(
        "That product is a one-time purchase; give it from the user's purchases instead",
      );
    }
  }
}

export const userProductService = new UserProductService();
