import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PlanScheduleError,
  activePeriod,
  assertDeletable,
  buildTimeline,
  planAppend,
  planOverride,
  type PeriodLike,
} from "./userPlan.planner";

/** A time on one fixed day, e.g. at(9) is 09:00. */
function at(hour: number, day = 1): Date {
  return new Date(Date.UTC(2026, 0, day, hour));
}

function period(
  id: string,
  startsAt: Date,
  endsAt: Date | null,
  planId = "pro",
): PeriodLike {
  return { id, planId, startsAt, endsAt };
}

describe("activePeriod", () => {
  it("includes the start and excludes the end", () => {
    const pro = period("a", at(8), at(9));
    assert.equal(activePeriod([pro], at(8))?.id, "a");
    assert.equal(activePeriod([pro], at(9)), null);
  });
});

describe("buildTimeline", () => {
  it("is just the default plan when nothing is assigned", () => {
    const timeline = buildTimeline([], at(10));
    assert.equal(timeline.length, 1);
    assert.equal(timeline[0]?.period, null);
    assert.equal(timeline[0]?.isCurrent, true);
    assert.equal(timeline[0]?.endsAt, null);
  });

  it("fills the gap between an ended plan and a later one with the default", () => {
    // Pro ended at 09:00, the user resubscribes from 11:00. It is now 10:00.
    const periods = [
      period("old", at(1), at(9)),
      period("new", at(11), at(11, 31)),
    ];
    const timeline = buildTimeline(periods, at(10));

    assert.deepEqual(
      timeline.map((s) => [s.period?.id ?? "default", s.isCurrent]),
      [
        ["default", true],
        ["new", false],
        ["default", false],
      ],
    );
    assert.deepEqual(timeline[0]?.startsAt, at(10));
    assert.deepEqual(timeline[0]?.endsAt, at(11));
    assert.equal(timeline[2]?.endsAt, null);
  });

  it("has no gaps and never ends", () => {
    const periods = [
      period("a", at(8), at(12)),
      period("b", at(12), at(15)),
      period("c", at(20), at(22)),
    ];
    const timeline = buildTimeline(periods, at(10));

    assert.deepEqual(timeline[0]?.startsAt, at(8));
    for (let i = 1; i < timeline.length; i++) {
      assert.deepEqual(timeline[i]?.startsAt, timeline[i - 1]?.endsAt);
    }
    assert.equal(timeline[timeline.length - 1]?.endsAt, null);
    assert.equal(timeline.filter((s) => s.isCurrent).length, 1);
  });

  it("stops at a plan that has no end", () => {
    const timeline = buildTimeline([period("a", at(8), null)], at(10));
    assert.equal(timeline.length, 1);
    assert.equal(timeline[0]?.period?.id, "a");
  });
});

describe("planOverride", () => {
  it("cuts the running plan short and starts the new one now", () => {
    const result = planOverride([period("a", at(8), at(20))], at(10), {
      kind: "days",
      days: 30,
    });
    assert.equal(result.truncateId, "a");
    assert.deepEqual(result.startsAt, at(10));
    assert.deepEqual(result.endsAt, at(10, 31));
  });

  it("has nothing to cut when the user is on the default plan", () => {
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

  it("refuses to run into a scheduled plan", () => {
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
  it("starts when the last scheduled plan ends", () => {
    const periods = [period("a", at(8), at(12)), period("b", at(14), at(18))];
    const result = planAppend(periods, at(10), { kind: "days", days: 1 });
    assert.deepEqual(result.startsAt, at(18));
    assert.deepEqual(result.endsAt, at(18, 2));
  });

  it("starts now when the user is on the default plan", () => {
    const result = planAppend([period("old", at(1), at(9))], at(10), {
      kind: "none",
    });
    assert.deepEqual(result.startsAt, at(10));
    assert.equal(result.endsAt, null);
  });

  it("refuses when the last plan never ends", () => {
    assert.throws(
      () =>
        planAppend([period("a", at(8), null)], at(10), {
          kind: "days",
          days: 30,
        }),
      PlanScheduleError,
    );
  });
});

describe("assertDeletable", () => {
  it("allows only plans that have not started", () => {
    assert.doesNotThrow(() =>
      assertDeletable(period("b", at(12), at(18)), at(10)),
    );
    assert.throws(
      () => assertDeletable(period("a", at(8), at(12)), at(10)),
      PlanScheduleError,
    );
    assert.throws(
      () => assertDeletable(period("old", at(1), at(9)), at(10)),
      PlanScheduleError,
    );
  });
});
