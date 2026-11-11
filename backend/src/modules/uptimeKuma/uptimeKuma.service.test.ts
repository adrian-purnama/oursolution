import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { monitorPayload, summarizeBeats } from "./uptimeKuma.service";

describe("summarizeBeats", () => {
  it("is pending with nothing to show before the first check", () => {
    assert.deepEqual(summarizeBeats([]), {
      state: "pending",
      uptime: null,
      responseMs: null,
      checkedAt: null,
      beats: [],
    });
  });

  it("takes the state from the latest check and averages the rest", () => {
    const status = summarizeBeats([
      { status: 1, time: "2026-11-11 10:00:00.000", ping: 100 },
      { status: 0, time: "2026-11-11 10:01:00.000", ping: null },
      { status: 2, time: "2026-11-11 10:02:00.000", ping: null },
      { status: 1, time: "2026-11-11 10:03:00.000", ping: 200 },
    ]);
    assert.equal(status.state, "up");
    // Pending checks count neither as up nor as down.
    assert.equal(status.uptime, 2 / 3);
    assert.equal(status.responseMs, 150);
    assert.equal(status.checkedAt, "2026-11-11T10:03:00.000Z");
    assert.deepEqual(
      status.beats.map((beat) => beat.state),
      ["up", "down", "pending", "up"],
    );
  });

  it("skips rows it cannot read and keeps only the latest checks", () => {
    const rows: unknown[] = [null, { status: 9, time: "x" }];
    for (let minute = 0; minute < 40; minute++) {
      rows.push({
        status: 0,
        time: `2026-11-11 10:${String(minute).padStart(2, "0")}:00.000`,
        ping: null,
      });
    }
    const status = summarizeBeats(rows);
    assert.equal(status.state, "down");
    assert.equal(status.uptime, 0);
    assert.equal(status.responseMs, null);
    assert.equal(status.beats.length, 30);
    assert.equal(status.beats.at(-1)?.at, "2026-11-11T10:39:00.000Z");
  });
});

describe("monitorPayload", () => {
  it("checks the host over https", () => {
    const payload = monitorPayload("n8n-jo.example.com", 2);
    assert.equal(payload.url, "https://n8n-jo.example.com");
    assert.equal(payload.name, "n8n-jo.example.com");
  });

  it("sends version 2's columns only to version 2", () => {
    assert.ok("conditions" in monitorPayload("a.example.com", 2));
    assert.ok(!("conditions" in monitorPayload("a.example.com", 1)));
    assert.ok(!("rabbitmqNodes" in monitorPayload("a.example.com", 1)));
  });
});
