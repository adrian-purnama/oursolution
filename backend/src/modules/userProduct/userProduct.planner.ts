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

/**
 * The period running at `now`, and the first one after it that is on
 * another variant: when the service will change variant next. With
 * nothing running, the next is simply the first scheduled period.
 */
export function variantChange<T extends PeriodLike & { variantId: string }>(
  periods: T[],
  now: Date,
): { current: T | null; next: T | null } {
  const current = (activePeriod(periods, now) as T | null) ?? null;
  const next =
    (upcomingPeriods(periods, now) as T[]).find(
      (period) => !current || period.variantId !== current.variantId,
    ) ?? null;
  return { current, next };
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

/** A running or scheduled period, with the variant it pays for. */
export type VariantPeriodLike = PeriodLike & { variantId: string };

export type SwitchPlan = {
  /** The running period, cut short at `startsAt`; null when none runs. */
  truncateId: string | null;
  /** Scheduled periods, replaced by the new one. */
  deleteIds: string[];
  startsAt: Date;
  endsAt: Date;
  /** What the time left was worth, in whole rupiah. */
  creditIdr: number;
  /** Time the credit adds on top of the days bought. */
  bonusMs: number;
};

/**
 * Switch to another variant now: the running period ends now, scheduled
 * ones go, and one period on the new variant starts now. It lasts the days
 * bought plus what the time left was worth, priced per day on each
 * period's own variant and turned into days of the new one. A new variant
 * that costs nothing keeps the time left as it is.
 *
 * `dailyPriceOf` gives a variant's price per day; null for one that is gone,
 * whose time is worth nothing.
 */
export function planSwitch(
  periods: VariantPeriodLike[],
  now: Date,
  dailyPriceOf: (variantId: string) => number | null,
  targetDailyPriceIdr: number,
  purchasedDays: number,
): SwitchPlan {
  if (purchasedDays <= 0) {
    throw new PlanScheduleError("A switch needs days to buy");
  }
  const live = liveSchedule(periods, now) as VariantPeriodLike[];
  if (live.some((period) => period.endsAt === null)) {
    throw new PlanScheduleError(
      "The subscription has no end date, so its time cannot be moved to another variant",
    );
  }

  let credit = 0;
  let leftMs = 0;
  for (const period of live) {
    const from = Math.max(period.startsAt.getTime(), now.getTime());
    const ms = Math.max(0, (period.endsAt as Date).getTime() - from);
    leftMs += ms;
    credit += (ms / DAY_MS) * (dailyPriceOf(period.variantId) ?? 0);
  }
  const bonusMs =
    targetDailyPriceIdr > 0 ? (credit / targetDailyPriceIdr) * DAY_MS : leftMs;
  // Whole seconds, so the end date reads cleanly.
  const totalMs = Math.floor((purchasedDays * DAY_MS + bonusMs) / 1000) * 1000;

  const current = activePeriod(live, now);
  return {
    truncateId: current?.id ?? null,
    deleteIds: upcomingPeriods(live, now).map((period) => period.id),
    startsAt: now,
    endsAt: new Date(now.getTime() + totalMs),
    creditIdr: Math.floor(credit),
    bonusMs: totalMs - purchasedDays * DAY_MS,
  };
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

/**
 * A period at fixed times must not overlap any running or scheduled period of
 * the same product.
 */
export function assertFree(periods: PeriodLike[], plan: AppendPlan): void {
  if (plan.endsAt !== null && plan.endsAt <= plan.startsAt) {
    throw new PlanScheduleError("The period ends before it starts");
  }
  const clash = periods.some(
    (period) =>
      (period.endsAt === null || period.endsAt > plan.startsAt) &&
      (plan.endsAt === null || period.startsAt < plan.endsAt),
  );
  if (clash) {
    throw new PlanScheduleError(
      "This product is already active or scheduled during that time",
    );
  }
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
