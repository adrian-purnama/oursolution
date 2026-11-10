import mongoose, { type HydratedDocument } from "mongoose";
import type {
  CreatePlanDto,
  PlanOutDto,
  PlanSummaryDto,
  PricingPlanOutDto,
  UpdatePlanDto,
} from "../../dto/plan.dto";
import { logger } from "../../logger/logger";
import type { PlanInterface } from "../../models/plan/plan.interface";
import { PlanModel } from "../../models/plan/plan.model";
import { UserPlanPeriodModel } from "../../models/userPlanPeriod/userPlanPeriod.model";

const logSource = "modules/plan/plan.service.ts";

type PlanDoc = HydratedDocument<PlanInterface>;

const SEED_DEFAULT_PLAN: CreatePlanDto = {
  name: "Free",
  color: "#6b6b6b",
  pricingText: "Free",
  priceIdr: 0,
  showOnPricingPage: true,
  isDefault: true,
};

export function toPlanOut(plan: PlanDoc): PlanOutDto {
  return {
    id: plan.id,
    name: plan.name,
    color: plan.color,
    pricingText: plan.pricingText,
    priceIdr: plan.priceIdr,
    showOnPricingPage: plan.showOnPricingPage,
    isDefault: plan.isDefault,
  };
}

export function toPlanSummary(plan: PlanDoc): PlanSummaryDto {
  return { id: plan.id, name: plan.name, color: plan.color };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === 11000
  );
}

export class PlanService {
  /** Creates the default plan on first start so every user always has one. */
  async ensureDefault(): Promise<void> {
    const existing = await PlanModel.findOne({ isDefault: true }).exec();
    if (existing) return;

    const named = await PlanModel.findOne({
      name: SEED_DEFAULT_PLAN.name,
    }).exec();
    if (named) {
      named.isDefault = true;
      await named.save();
    } else {
      await PlanModel.create(SEED_DEFAULT_PLAN);
    }
    logger.info(
      `No default plan found, "${SEED_DEFAULT_PLAN.name}" is now the default`,
      logSource,
      "ensureDefault",
    );
  }

  async getDefault(): Promise<PlanDoc> {
    const plan = await PlanModel.findOne({ isDefault: true }).exec();
    if (!plan) throw new Error("No default plan is configured");
    return plan;
  }

  async list(): Promise<PlanOutDto[]> {
    const plans = await PlanModel.find().sort({ priceIdr: 1, name: 1 }).exec();
    return plans.map(toPlanOut);
  }

  async listPricing(): Promise<PricingPlanOutDto[]> {
    const plans = await PlanModel.find({ showOnPricingPage: true })
      .sort({ priceIdr: 1, name: 1 })
      .exec();
    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      color: plan.color,
      pricingText: plan.pricingText,
    }));
  }

  async create(input: CreatePlanDto): Promise<PlanOutDto> {
    try {
      let created: PlanDoc | undefined;
      await mongoose.connection.transaction(async (session) => {
        if (input.isDefault) {
          await PlanModel.updateMany(
            { isDefault: true },
            { $set: { isDefault: false } },
            { session },
          );
        }
        [created] = await PlanModel.create([input], { session });
      });
      return toPlanOut(created!);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new Error("A plan with this name already exists");
      }
      throw error;
    }
  }

  async update(id: string, patch: UpdatePlanDto): Promise<PlanOutDto> {
    const plan = await PlanModel.findById(id).exec();
    if (!plan) throw new Error("Plan not found");

    if (patch.isDefault === false && plan.isDefault) {
      throw new Error(
        "There must always be a default plan. Make another plan the default instead.",
      );
    }

    try {
      await mongoose.connection.transaction(async (session) => {
        if (patch.isDefault === true && !plan.isDefault) {
          await PlanModel.updateMany(
            { isDefault: true },
            { $set: { isDefault: false } },
            { session },
          );
        }
        plan.set(patch);
        await plan.save({ session });
      });
      return toPlanOut(plan);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new Error("A plan with this name already exists");
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const plan = await PlanModel.findById(id).exec();
    if (!plan) throw new Error("Plan not found");
    if (plan.isDefault) {
      throw new Error(
        "The default plan cannot be deleted. Make another plan the default first.",
      );
    }

    const inUse = await UserPlanPeriodModel.countDocuments({
      planId: plan._id,
    }).exec();
    if (inUse > 0) {
      throw new Error(
        `This plan is used by ${inUse} plan period(s), past or scheduled, and cannot be deleted`,
      );
    }

    await plan.deleteOne();
  }
}

export const planService = new PlanService();
