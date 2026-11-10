import mongoose, { Types, type HydratedDocument } from "mongoose";
import type { PlanSummaryDto } from "../../dto/plan.dto";
import type {
  AssignPlanDto,
  PlanSegmentOutDto,
  UserPlanOverviewOutDto,
} from "../../dto/userPlan.dto";
import type { PlanInterface } from "../../models/plan/plan.interface";
import { PlanModel } from "../../models/plan/plan.model";
import { UserModel } from "../../models/user/user.model";
import type { UserPlanPeriodInterface } from "../../models/userPlanPeriod/userPlanPeriod.interface";
import { UserPlanPeriodModel } from "../../models/userPlanPeriod/userPlanPeriod.model";
import { planService, toPlanSummary } from "../plan/plan.service";
import {
  assertDeletable,
  buildTimeline,
  planAppend,
  planOverride,
  type PeriodLike,
} from "./userPlan.planner";

const HISTORY_LIMIT = 10;

type PlanDoc = HydratedDocument<PlanInterface>;
type PeriodDoc = HydratedDocument<UserPlanPeriodInterface>;

function toPeriodLike(doc: PeriodDoc): PeriodLike {
  return {
    id: doc.id,
    planId: doc.planId.toString(),
    startsAt: doc.startsAt,
    endsAt: doc.endsAt,
  };
}

export class UserPlanService {
  /** The plan the user is on at `now`: their running period, else the default. */
  async getCurrentPlan(
    userId: string,
    now: Date = new Date(),
  ): Promise<PlanDoc> {
    const period = await UserPlanPeriodModel.findOne({
      userId,
      startsAt: { $lte: now },
      $or: [{ endsAt: null }, { endsAt: { $gt: now } }],
    })
      .sort({ startsAt: -1 })
      .exec();

    const plan = period ? await PlanModel.findById(period.planId).exec() : null;
    return plan ?? planService.getDefault();
  }

  async getCurrentPlanSummary(userId: string): Promise<PlanSummaryDto> {
    return toPlanSummary(await this.getCurrentPlan(userId));
  }

  async getOverview(
    userId: string,
    now: Date = new Date(),
  ): Promise<UserPlanOverviewOutDto> {
    await this.requireUser(userId);

    const [liveDocs, pastDocs, defaultPlan] = await Promise.all([
      this.loadLivePeriods(userId, now),
      UserPlanPeriodModel.find({ userId, endsAt: { $ne: null, $lte: now } })
        .sort({ endsAt: -1 })
        .limit(HISTORY_LIMIT)
        .exec(),
      planService.getDefault(),
    ]);

    const docsById = new Map(
      [...liveDocs, ...pastDocs].map((doc) => [doc.id as string, doc]),
    );
    const plans = await PlanModel.find({
      _id: { $in: [...docsById.values()].map((doc) => doc.planId) },
    }).exec();
    const plansById = new Map(plans.map((plan) => [plan.id as string, plan]));
    const fallback = toPlanSummary(defaultPlan);

    const summaryFor = (period: PeriodLike | null): PlanSummaryDto => {
      const plan = period ? plansById.get(period.planId) : undefined;
      return plan ? toPlanSummary(plan) : fallback;
    };

    const timeline: PlanSegmentOutDto[] = buildTimeline(
      liveDocs.map(toPeriodLike),
      now,
    ).map((segment) => ({
      periodId: segment.period?.id ?? null,
      plan: summaryFor(segment.period),
      startsAt: segment.startsAt.toISOString(),
      endsAt: segment.endsAt?.toISOString() ?? null,
      isCurrent: segment.isCurrent,
      isFallback: segment.period === null,
      source: segment.period
        ? (docsById.get(segment.period.id)?.source ?? null)
        : null,
    }));

    const history: PlanSegmentOutDto[] = pastDocs.map((doc) => ({
      periodId: doc.id,
      plan: summaryFor(toPeriodLike(doc)),
      startsAt: doc.startsAt.toISOString(),
      endsAt: doc.endsAt?.toISOString() ?? null,
      isCurrent: false,
      isFallback: false,
      source: doc.source,
    }));

    return { current: timeline[0]!, timeline, history };
  }

  /** Put the user on a plan right now, cutting short whatever was running. */
  async overrideNow(
    userId: string,
    input: AssignPlanDto,
    actorId: string,
    now: Date = new Date(),
  ): Promise<UserPlanOverviewOutDto> {
    await this.requireUser(userId);
    await this.requirePlan(input.planId);

    const periods = await this.loadLivePeriods(userId, now);
    const plan = planOverride(periods.map(toPeriodLike), now, input.end);

    await mongoose.connection.transaction(async (session) => {
      if (plan.truncateId) {
        await UserPlanPeriodModel.updateOne(
          { _id: plan.truncateId },
          { $set: { endsAt: plan.startsAt } },
          { session },
        );
      }
      await UserPlanPeriodModel.create(
        [
          {
            userId,
            planId: input.planId,
            startsAt: plan.startsAt,
            endsAt: plan.endsAt,
            source: "admin",
            createdBy: new Types.ObjectId(actorId),
          },
        ],
        { session },
      );
    });

    return this.getOverview(userId);
  }

  /** Queue a plan to start when everything already scheduled has ended. */
  async scheduleNext(
    userId: string,
    input: AssignPlanDto,
    actorId: string,
    now: Date = new Date(),
  ): Promise<UserPlanOverviewOutDto> {
    await this.requireUser(userId);
    await this.requirePlan(input.planId);

    const periods = await this.loadLivePeriods(userId, now);
    const plan = planAppend(periods.map(toPeriodLike), now, input.end);

    await UserPlanPeriodModel.create({
      userId,
      planId: input.planId,
      startsAt: plan.startsAt,
      endsAt: plan.endsAt,
      source: "admin",
      createdBy: new Types.ObjectId(actorId),
    });

    return this.getOverview(userId);
  }

  /** Remove a period that has not started; the default plan fills the hole. */
  async deleteScheduled(
    userId: string,
    periodId: string,
    now: Date = new Date(),
  ): Promise<UserPlanOverviewOutDto> {
    const period = await UserPlanPeriodModel.findOne({
      _id: periodId,
      userId,
    }).exec();
    if (!period) throw new Error("Plan period not found");

    assertDeletable(toPeriodLike(period), now);
    await period.deleteOne();

    return this.getOverview(userId);
  }

  /** Periods that are running or still to come, earliest first. */
  private async loadLivePeriods(
    userId: string,
    now: Date,
  ): Promise<PeriodDoc[]> {
    return UserPlanPeriodModel.find({
      userId,
      $or: [{ endsAt: null }, { endsAt: { $gt: now } }],
    })
      .sort({ startsAt: 1 })
      .exec();
  }

  private async requireUser(userId: string): Promise<void> {
    const exists = await UserModel.exists({ _id: userId });
    if (!exists) throw new Error("User not found");
  }

  private async requirePlan(planId: string): Promise<void> {
    const exists = await PlanModel.exists({ _id: planId });
    if (!exists) throw new Error("Plan not found");
  }
}

export const userPlanService = new UserPlanService();
