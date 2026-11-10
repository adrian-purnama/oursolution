import type { PeriodEndSpec } from "../../dto/userProduct.dto";

/**
 * Pure scheduling rules for one product on one user's plan. Callers pass the
 * periods of a single (user, product) pair. Nothing here touches the database,
 * so every rule can be tested directly.
 *
 * Invariants:
 * - periods of the same product never overlap (other products are unaffected);
 * - time not covered by a period means the product is not active;
 * - running and scheduled periods can be deleted; ended ones are history.
 */

export type PeriodLike = {
  id: string;
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

/** The running period (if any) followed by the scheduled ones. */
export function liveSchedule(periods: PeriodLike[], now: Date): PeriodLike[] {
  const current = activePeriod(periods, now);
  return [...(current ? [current] : []), ...upcomingPeriods(periods, now)];
}

function resolveEnd(
  start: Date,
  end: PeriodEndSpec,
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
          "The current period has no end date to reuse",
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

/** Replace the product's running period with a new one starting now. */
export function planOverride(
  periods: PeriodLike[],
  now: Date,
  end: PeriodEndSpec,
): OverridePlan {
  const current = activePeriod(periods, now);
  const next = upcomingPeriods(periods, now)[0];
  const endsAt = resolveEnd(now, end, current);

  if (next && (endsAt === null || endsAt > next.startsAt)) {
    throw new PlanScheduleError(
      `This would overlap the period scheduled to start on ${next.startsAt.toISOString()}. End before then, or delete that scheduled period first.`,
    );
  }

  return { truncateId: current?.id ?? null, startsAt: now, endsAt };
}

export type AppendPlan = {
  startsAt: Date;
  endsAt: Date | null;
};

/** Queue a period right after everything already scheduled for the product. */
export function planAppend(
  periods: PeriodLike[],
  now: Date,
  end: PeriodEndSpec,
): AppendPlan {
  if (end.kind === "currentEnd") {
    throw new PlanScheduleError(
      "A queued period needs its own duration or end date",
    );
  }

  const last = liveSchedule(periods, now).at(-1);

  if (last && last.endsAt === null) {
    throw new PlanScheduleError(
      "This product is already active with no end date, so nothing can come after it.",
    );
  }

  const startsAt = last?.endsAt ?? now;
  return { startsAt, endsAt: resolveEnd(startsAt, end, null) };
}

/** Stop the product now: the running period ends at `now`. */
export function planEndNow(periods: PeriodLike[], now: Date): string {
  const current = activePeriod(periods, now);
  if (!current) {
    throw new PlanScheduleError("This product is not active right now");
  }
  return current.id;
}

/**
 * Running and scheduled periods may be deleted. A deleted running period is
 * gone as if it never happened (unlike ending it now, which keeps it). Ended
 * periods are history and stay.
 */
export function assertDeletable(period: PeriodLike, now: Date): void {
  if (period.endsAt !== null && period.endsAt <= now) {
    throw new PlanScheduleError(
      "Periods that have already ended cannot be deleted",
    );
  }
}
