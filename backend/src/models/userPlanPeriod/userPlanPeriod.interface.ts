import { Types } from "mongoose";

export const PLAN_PERIOD_SOURCES = ["admin", "subscription"] as const;
export type PlanPeriodSource = (typeof PLAN_PERIOD_SOURCES)[number];

/**
 * A stretch of time during which a user is on a specific plan. Periods of one
 * user never overlap. Time not covered by any period is the default plan; that
 * is resolved when read, so no "default" periods are stored.
 */
export interface UserPlanPeriodInterface {
  userId: Types.ObjectId;
  planId: Types.ObjectId;
  startsAt: Date;
  /** null means "until changed". */
  endsAt: Date | null;
  source: PlanPeriodSource;
  /** The admin who created it, when source is "admin". */
  createdBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}
