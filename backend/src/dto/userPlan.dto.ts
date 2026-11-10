import type { PlanSummaryDto } from "./plan.dto";

/** One stretch of the user's plan timeline, stored or filled in with the default. */
export interface PlanSegmentOutDto {
  /** null for a default-plan stretch that is not stored. */
  periodId: string | null;
  plan: PlanSummaryDto;
  startsAt: string;
  /** null means no end. */
  endsAt: string | null;
  isCurrent: boolean;
  /** True when this is the default plan filling a gap, not an assigned period. */
  isFallback: boolean;
  source: string | null;
}

export interface UserPlanOverviewOutDto {
  current: PlanSegmentOutDto;
  /** From now on, in order, with no gaps. The first entry is the current one. */
  timeline: PlanSegmentOutDto[];
  /** Most recent finished periods, newest first. */
  history: PlanSegmentOutDto[];
}

/** How long a newly assigned period lasts. */
export type PlanEndSpec =
  | { kind: "none" }
  | { kind: "days"; days: number }
  | { kind: "date"; at: Date }
  | { kind: "currentEnd" };

export interface AssignPlanDto {
  planId: string;
  end: PlanEndSpec;
}
