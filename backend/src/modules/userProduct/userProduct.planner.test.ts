import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PlanScheduleError,
  activePeriod,
  assertDeletable,
  assertFree,
  liveSchedule,
  planAppend,
  planEndNow,
  planOverride,
  planSwitch,
  variantChange,
  type PeriodLike,
} from "./userProduct.planner";

/** A time on one fixed day, e.g. at(9) is 09:00. */
function at(hour: number, day = 1): Date {
  return new Date(Date.UTC(2026, 0, day, hour));
}

function period(id: string, startsAt: Date, endsAt: Date | null): PeriodLike {
  return { id, startsAt, endsAt };
}

describe("activePeriod", () => {
  it("includes the start and excludes the end", () => {
    const p = period("a", at(8), at(9));
    assert.equal(activePeriod([p], at(8))?.id, "a");
    assert.equal(activePeriod([p], at(9)), null);
  });

  it("is nothing when no period covers now (the product is inactive)", () => {
    assert.equal(activePeriod([period("old", at(1), at(9))], at(10)), null);
    assert.equal(activePeriod([], at(10)), null);
  });
});

describe("liveSchedule", () => {
  it("is the running period then the scheduled ones, without gap filling", () => {
    const periods = [
      period("c", at(20), at(22)),
      period("old", at(1), at(5)),
      period("a", at(8), at(12)),
      period("b", at(14), at(15)),
    ];
    assert.deepEqual(
      liveSchedule(periods, at(10)).map((p) => p.id),
      ["a", "b", "c"],
    );
  });

  it("is only upcoming periods while the product is inactive", () => {
    const periods = [period("old", at(1), at(9)), period("b", at(11), at(12))];
    assert.deepEqual(
      liveSchedule(periods, at(10)).map((p) => p.id),
      ["b"],
    );
  });
});

describe("planOverride", () => {
  it("cuts the running period short and starts the new one now", () => {
    const result = planOverride([period("a", at(8), at(20))], at(10), {
      kind: "days",
      days: 30,
    });
    assert.equal(result.truncateId, "a");
    assert.deepEqual(result.startsAt, at(10));
    assert.deepEqual(result.endsAt, at(10, 31));
  });

  it("has nothing to cut when the product is inactive", () => {
    const result = planOverride([], at(10), { kind: "none" });
    assert.equal(result.truncateId, null);
    assert.equal(result.endsAt, null);
  });

  it("can take over the rest of the current period", () => {
    const result = planOverride([period("a", at(8), at(20))], at(10), {
      kind: "currentEnd",
    });
    assert.deepEqual(result.endsAt, at(20));
  });

  it("refuses to run into a scheduled period", () => {
    const periods = [period("a", at(8), at(12)), period("b", at(12), at(18))];
    assert.throws(
      () => planOverride(periods, at(10), { kind: "date", at: at(13) }),
      PlanScheduleError,
    );
    assert.throws(
      () => planOverride(periods, at(10), { kind: "none" }),
      PlanScheduleError,
    );
    // Ending exactly when the next one starts is fine.
    const result = planOverride(periods, at(10), { kind: "date", at: at(12) });
    assert.deepEqual(result.endsAt, at(12));
  });

  it("rejects an end that is not in the future", () => {
    assert.throws(
      () => planOverride([], at(10), { kind: "date", at: at(10) }),
      PlanScheduleError,
    );
  });
});

describe("planAppend", () => {
  it("starts when the last scheduled period ends", () => {
    const periods = [period("a", at(8), at(12)), period("b", at(14), at(18))];
    const result = planAppend(periods, at(10), { kind: "days", days: 1 });
    assert.deepEqual(result.startsAt, at(18));
    assert.deepEqual(result.endsAt, at(18, 2));
  });

  it("starts now when the product is inactive", () => {
    const result = planAppend([period("old", at(1), at(9))], at(10), {
      kind: "days",
      days: 30,
    });
    assert.deepEqual(result.startsAt, at(10));
    assert.deepEqual(result.endsAt, at(10, 31));
  });

  it("refuses when the last period never ends", () => {
    assert.throws(
      () =>
        planAppend([period("a", at(8), null)], at(10), {
          kind: "days",
          days: 30,
        }),
      PlanScheduleError,
    );
  });

  it("refuses to reuse the current end", () => {
    assert.throws(
      () => planAppend([], at(10), { kind: "currentEnd" }),
      PlanScheduleError,
    );
  });
});

describe("planEndNow", () => {
  it("names the running period", () => {
    const periods = [period("a", at(8), null), period("b", at(1), at(5))];
    assert.equal(planEndNow(periods, at(10)), "a");
  });

  it("refuses when the product is not active", () => {
    assert.throws(
      () => planEndNow([period("b", at(11), at(12))], at(10)),
      PlanScheduleError,
    );
  });
});

describe("assertDeletable", () => {
  it("allows scheduled and running periods", () => {
    assert.doesNotThrow(() =>
      assertDeletable(period("b", at(12), at(18)), at(10)),
    );
    assert.doesNotThrow(() =>
      assertDeletable(period("a", at(8), at(12)), at(10)),
    );
    assert.doesNotThrow(() =>
      assertDeletable(period("open", at(8), null), at(10)),
    );
  });

  it("refuses periods that have ended", () => {
    assert.throws(
      () => assertDeletable(period("old", at(1), at(9)), at(10)),
      PlanScheduleError,
    );
    // Ending exactly now counts as ended.
    assert.throws(
      () => assertDeletable(period("edge", at(1), at(10)), at(10)),
      PlanScheduleError,
    );
  });
});

describe("assertFree", () => {
  const booked = [period("a", at(9), at(12))];

  it("allows a period that starts when another ends", () => {
    assert.doesNotThrow(() =>
      assertFree(booked, { startsAt: at(12), endsAt: at(15) }),
    );
  });

  it("refuses a period that overlaps", () => {
    assert.throws(
      () => assertFree(booked, { startsAt: at(11), endsAt: at(15) }),
      PlanScheduleError,
    );
  });

  it("refuses an endless period before a booked one", () => {
    assert.throws(
      () => assertFree(booked, { startsAt: at(6), endsAt: null }),
      PlanScheduleError,
    );
  });
});

describe("variantChange", () => {
  const on = (variantId: string, p: PeriodLike) => ({ ...p, variantId });

  it("finds the running period and the first later one on another variant", () => {
    const periods = [
      on("small", period("a", at(0), at(10))),
      on("small", period("b", at(10), at(20))),
      on("big", period("c", at(20), at(23))),
    ];
    const { current, next } = variantChange(periods, at(5));
    assert.equal(current?.id, "a");
    assert.equal(next?.id, "c");
  });

  it("has no next when every later period is on the same variant", () => {
    const periods = [
      on("small", period("a", at(0), at(10))),
      on("small", period("b", at(10), at(20))),
    ];
    assert.equal(variantChange(periods, at(5)).next, null);
  });

  it("with nothing running, the next is the first scheduled period", () => {
    const periods = [on("big", period("c", at(20), at(23)))];
    const { current, next } = variantChange(periods, at(5));
    assert.equal(current, null);
    assert.equal(next?.id, "c");
  });
});

describe("planSwitch", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * DAY);
  const on = (variantId: string, id: string, from: number, to: number) => ({
    id,
    startsAt: day(from),
    endsAt: day(to),
    variantId,
  });
  // A: 50k / 30 days, B: 100k / 30 days.
  const prices: Record<string, number> = { a: 50_000 / 30, b: 100_000 / 30 };
  const priceOf = (id: string) => prices[id] ?? null;

  it("turns 15 days left of A into 7.5 days of B, on top of the days bought", () => {
    const plan = planSwitch(
      [on("a", "p1", 0, 30)],
      day(15),
      priceOf,
      prices.b,
      30,
    );
    assert.equal(plan.truncateId, "p1");
    assert.deepEqual(plan.deleteIds, []);
    assert.equal(plan.startsAt.getTime(), day(15).getTime());
    assert.equal(plan.creditIdr, 25_000);
    assert.equal(plan.bonusMs, 7.5 * DAY);
    assert.equal(plan.endsAt.getTime(), day(15 + 37.5).getTime());
  });

  it("gives more days when switching to a cheaper variant", () => {
    const plan = planSwitch(
      [on("b", "p1", 0, 30)],
      day(15),
      priceOf,
      prices.a,
      30,
    );
    assert.equal(plan.bonusMs, 30 * DAY);
  });

  it("counts scheduled periods too, and replaces them", () => {
    const plan = planSwitch(
      [on("a", "p1", 0, 30), on("a", "p2", 30, 60)],
      day(15),
      priceOf,
      prices.b,
      30,
    );
    assert.deepEqual(plan.deleteIds, ["p2"]);
    // 45 days of A = 75k = 22.5 days of B.
    assert.equal(plan.bonusMs, 22.5 * DAY);
  });

  it("with nothing running, is just the days bought from now", () => {
    const plan = planSwitch([], day(3), priceOf, prices.b, 30);
    assert.equal(plan.truncateId, null);
    assert.equal(plan.creditIdr, 0);
    assert.equal(plan.endsAt.getTime(), day(33).getTime());
  });

  it("keeps the time left as it is when the new variant is free", () => {
    const plan = planSwitch([on("a", "p1", 0, 30)], day(20), priceOf, 0, 30);
    assert.equal(plan.bonusMs, 10 * DAY);
  });

  it("values a removed variant's time at nothing", () => {
    const plan = planSwitch(
      [on("gone", "p1", 0, 30)],
      day(15),
      priceOf,
      prices.b,
      30,
    );
    assert.equal(plan.bonusMs, 0);
  });

  it("refuses a subscription without an end, or no days", () => {
    assert.throws(
      () =>
        planSwitch(
          [{ id: "p1", startsAt: day(0), endsAt: null, variantId: "a" }],
          day(1),
          priceOf,
          prices.b,
          30,
        ),
      PlanScheduleError,
    );
    assert.throws(
      () => planSwitch([], day(1), priceOf, prices.b, 0),
      PlanScheduleError,
    );
  });
});
