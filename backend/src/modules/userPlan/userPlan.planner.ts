import type { PlanEndSpec } from "../../dto/userPlan.dto";

/**
 * Pure scheduling rules for a user's plan periods. Nothing here touches the
 * database, so every rule can be tested directly.
 *
 * Invariants:
 * - a user's periods never overlap;
 * - time not covered by a period is the default plan (never stored);
 * - only periods that have not started can be deleted.
 */

export type PeriodLike = {
  id: string;
  planId: string;
  startsAt: Date;
  endsAt: Date | null;
};

export class PlanScheduleError extends Error {}

const DAY_MS = 24 * 60 * 60 * 1000;

function byStart(a: PeriodLike, b: PeriodLike): number {
  return a.startsAt.getTime() - b.startsAt.getTime();
}

/** The period covering `now`, if any. */
export function activePeriod(
  periods: PeriodLike[],
  now: Date,
): PeriodLike | null {
  return (
    periods.find(
      (p) => p.startsAt <= now && (p.endsAt === null || p.endsAt > now),
    ) ?? null
  );
}

/** Periods that have not started yet, earliest first. */
export function upcomingPeriods(
  periods: PeriodLike[],
  now: Date,
): PeriodLike[] {
  return periods.filter((p) => p.startsAt > now).sort(byStart);
}

function resolveEnd(
  start: Date,
  end: PlanEndSpec,
  current: PeriodLike | null,
): Date | null {
  let endsAt: Date | null;
  switch (end.kind) {
    case "none":
      return null;
    case "days":
      endsAt = new Date(start.getTime() + end.days * DAY_MS);
      break;
    case "date":
      endsAt = end.at;
      break;
    case "currentEnd":
      if (!current?.endsAt) {
        throw new PlanScheduleError(
          "The current plan has no end date to reuse",
        );
      }
      endsAt = current.endsAt;
      break;
  }
  if (endsAt <= start) {
    throw new PlanScheduleError("The end must be after the start");
  }
  return endsAt;
}

export type OverridePlan = {
  /** The period to cut short at `startsAt`, if one is running. */
  truncateId: string | null;
  startsAt: Date;
  endsAt: Date | null;
};

/** Replace whatever the user is on right now with a new period starting now. */
export function planOverride(
  periods: PeriodLike[],
  now: Date,
  end: PlanEndSpec,
): OverridePlan {
  const current = activePeriod(periods, now);
  const next = upcomingPeriods(periods, now)[0];
  const endsAt = resolveEnd(now, end, current);

  if (next && (endsAt === null || endsAt > next.startsAt)) {
    throw new PlanScheduleError(
      `This would overlap the plan scheduled to start on ${next.startsAt.toISOString()}. End before then, or delete that scheduled plan first.`,
    );
  }

  return { truncateId: current?.id ?? null, startsAt: now, endsAt };
}

export type AppendPlan = {
  startsAt: Date;
  endsAt: Date | null;
};

/** Queue a period right after everything already scheduled. */
export function planAppend(
  periods: PeriodLike[],
  now: Date,
  end: PlanEndSpec,
): AppendPlan {
  if (end.kind === "currentEnd") {
    throw new PlanScheduleError(
      "A queued plan needs its own duration or end date",
    );
  }

  const current = activePeriod(periods, now);
  const scheduled = [
    ...(current ? [current] : []),
    ...upcomingPeriods(periods, now),
  ];
  const last = scheduled[scheduled.length - 1];

  if (last && last.endsAt === null) {
    throw new PlanScheduleError(
      "The last scheduled plan has no end date, so nothing can come after it. Change the current plan instead.",
    );
  }

  const startsAt = last?.endsAt ?? now;
  return { startsAt, endsAt: resolveEnd(startsAt, end, null) };
}

/** Only periods that have not started may be deleted. */
export function assertDeletable(period: PeriodLike, now: Date): void {
  if (period.startsAt <= now) {
    throw new PlanScheduleError(
      "Only plans that have not started yet can be deleted",
    );
  }
}

export type TimelineSegment = {
  /** null for a default-plan stretch. */
  period: PeriodLike | null;
  startsAt: Date;
  endsAt: Date | null;
  isCurrent: boolean;
};

/**
 * The user's plan from `now` onwards with every gap filled by the default
 * plan. The first segment is always the current one and the last never ends.
 */
export function buildTimeline(
  periods: PeriodLike[],
  now: Date,
): TimelineSegment[] {
  const current = activePeriod(periods, now);
  const scheduled = [
    ...(current ? [current] : []),
    ...upcomingPeriods(periods, now),
  ];

  const segments: TimelineSegment[] = [];
  let cursor: Date | null = now;

  for (const period of scheduled) {
    if (cursor === null) break;
    if (period.startsAt > cursor) {
      segments.push({
        period: null,
        startsAt: cursor,
        endsAt: period.startsAt,
        isCurrent: segments.length === 0,
      });
    }
    segments.push({
      period,
      startsAt: period.startsAt,
      endsAt: period.endsAt,
      isCurrent: segments.length === 0,
    });
    cursor = period.endsAt;
  }

  if (cursor !== null) {
    segments.push({
      period: null,
      startsAt: cursor,
      endsAt: null,
      isCurrent: segments.length === 0,
    });
  }

  return segments;
}
