import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allowedActions,
  commandBlocker,
  domainIssue,
  nextAllowedStart,
  mayBeRunning,
  shouldAutoTurnOff,
  syncedState,
  wipeBlocker,
} from "./deployment.rules";

describe("syncedState", () => {
  it("follows containers that run, whatever we had stored", () => {
    assert.equal(syncedState("stopped", "running"), "running");
    assert.equal(syncedState("failed", "running"), "running");
    assert.equal(syncedState("running", "running"), "running");
  });

  it("turns a service we thought was up off when nothing runs", () => {
    assert.equal(syncedState("running", "stopped"), "stopped");
    assert.equal(syncedState("running", "missing"), "stopped");
  });

  it("flags a half-running service", () => {
    assert.equal(syncedState("running", "degraded"), "failed");
    assert.equal(syncedState("stopped", "degraded"), "failed");
  });

  it("keeps failed and stopped when nothing runs, and never a busy state", () => {
    assert.equal(syncedState("failed", "stopped"), "failed");
    assert.equal(syncedState("stopped", "missing"), "stopped");
    assert.equal(syncedState("deploying", "running"), "deploying");
    assert.equal(syncedState("stopping", "stopped"), "stopping");
    assert.equal(syncedState("notDeployed", "missing"), "notDeployed");
  });
});

describe("domainIssue", () => {
  it("wants a running service's host registered and on", () => {
    assert.equal(domainIssue("running", { registered: true, on: true }), null);
    assert.match(
      domainIssue("running", { registered: false, on: true }) ?? "",
      /Dokploy/,
    );
    assert.match(
      domainIssue("running", { registered: true, on: false }) ?? "",
      /Cloudflare/,
    );
  });

  it("wants an off service's host off, registered or not", () => {
    assert.equal(domainIssue("stopped", { registered: true, on: false }), null);
    assert.match(
      domainIssue("stopped", { registered: true, on: true }) ?? "",
      /off/,
    );
    assert.match(
      domainIssue("notDeployed", { registered: null, on: true }) ?? "",
      /off/,
    );
  });

  it("says nothing about what could not be checked, or is failed or busy", () => {
    assert.equal(domainIssue("running", { registered: null, on: null }), null);
    assert.equal(domainIssue("failed", { registered: false, on: true }), null);
    assert.equal(
      domainIssue("deploying", { registered: false, on: false }),
      null,
    );
  });
});

describe("shouldAutoTurnOff", () => {
  const ok = { action: "deploy" as const, automatic: false, failed: false };

  it("turns off what may run once the subscription has ended", () => {
    assert.equal(shouldAutoTurnOff("running", false, ok), true);
    assert.equal(shouldAutoTurnOff("failed", false, null), true);
  });

  it("leaves entitled, stopped and busy deployments alone", () => {
    assert.equal(shouldAutoTurnOff("running", true, ok), false);
    assert.equal(shouldAutoTurnOff("stopped", false, ok), false);
    assert.equal(shouldAutoTurnOff("deploying", false, ok), false);
  });

  it("does not retry its own failed turn-off", () => {
    const failedAuto = {
      action: "turnOff" as const,
      automatic: true,
      failed: true,
    };
    assert.equal(shouldAutoTurnOff("failed", false, failedAuto), false);
    // A failed turn-off someone started by hand is retried.
    assert.equal(
      shouldAutoTurnOff("failed", false, { ...failedAuto, automatic: false }),
      true,
    );
  });
});

describe("allowedActions", () => {
  it("follows the state while the subscription runs", () => {
    assert.deepEqual(allowedActions("notDeployed", true), ["deploy"]);
    assert.deepEqual(allowedActions("running", true), [
      "restart",
      "redeploy",
      "turnOff",
    ]);
    assert.deepEqual(allowedActions("stopped", true), ["deploy", "erase"]);
    assert.deepEqual(allowedActions("failed", true), ["deploy", "turnOff"]);
    assert.deepEqual(allowedActions("deploying", true), []);
  });

  it("only allows turning off once the subscription has ended", () => {
    assert.deepEqual(allowedActions("running", false), ["turnOff"]);
    assert.deepEqual(allowedActions("stopped", false), []);
    assert.deepEqual(allowedActions("notDeployed", false), []);
  });
});

describe("mayBeRunning", () => {
  it("is true when containers may still be up", () => {
    assert.equal(mayBeRunning("running"), true);
    assert.equal(mayBeRunning("failed"), true);
    assert.equal(mayBeRunning("stopped"), false);
  });
});

describe("nextAllowedStart", () => {
  const now = new Date("2026-11-11T12:00:00Z");
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

  it("allows the first starts", () => {
    assert.equal(nextAllowedStart("deploy", [], now), null);
    const five = [1, 2, 3, 4, 5].map((minutes) => ({
      action: "restart" as const,
      startedAt: ago(minutes),
    }));
    assert.equal(nextAllowedStart("deploy", five, now), null);
  });

  it("stops the seventh start in an hour until the oldest is an hour old", () => {
    const six = [50, 40, 30, 20, 10, 1].map((minutes) => ({
      action: "deploy" as const,
      startedAt: ago(minutes),
    }));
    assert.deepEqual(
      nextAllowedStart("redeploy", six, now),
      new Date("2026-11-11T12:10:00Z"),
    );
    // Starts older than the window no longer count.
    assert.equal(
      nextAllowedStart(
        "deploy",
        [...six.slice(1), { ...six[0], startedAt: ago(61) }],
        now,
      ),
      null,
    );
  });

  it("allows two erases a day", () => {
    const erases = [600, 300].map((minutes) => ({
      action: "erase" as const,
      startedAt: ago(minutes),
    }));
    assert.equal(nextAllowedStart("erase", erases.slice(1), now), null);
    assert.deepEqual(
      nextAllowedStart("erase", erases, now),
      new Date("2026-11-12T02:00:00Z"),
    );
    assert.equal(nextAllowedStart("restart", erases, now), null);
  });

  it("never limits turning off", () => {
    const many = Array.from({ length: 50 }, (_item, index) => ({
      action: "deploy" as const,
      startedAt: ago(index),
    }));
    assert.equal(nextAllowedStart("turnOff", many, now), null);
  });
});

describe("wipeBlocker", () => {
  it("allows deleting data only when off, unsubscribed and with folders", () => {
    assert.equal(wipeBlocker("stopped", false, 1), null);
  });

  it("blocks while the subscription runs", () => {
    assert.match(wipeBlocker("stopped", true, 1) ?? "", /subscription/i);
  });

  it("blocks unless the service is off", () => {
    for (const state of [
      "running",
      "failed",
      "deploying",
      "erasing",
    ] as const) {
      assert.match(wipeBlocker(state, false, 1) ?? "", /off/i, state);
    }
    assert.match(wipeBlocker("notDeployed", false, 1) ?? "", /never/i);
  });

  it("blocks when no folder is this customer's only", () => {
    assert.match(wipeBlocker("stopped", false, 0) ?? "", /folder/i);
  });

  it("is never offered as a normal action", () => {
    assert.equal(allowedActions("stopped", false).includes("wipe"), false);
    assert.equal(allowedActions("stopped", true).includes("wipe"), false);
    assert.deepEqual(allowedActions("erasing", true), []);
  });
});

describe("commandBlocker", () => {
  it("lets commands run only while the service runs and is paid for", () => {
    assert.equal(commandBlocker("running", true), null);
    assert.match(commandBlocker("running", false) ?? "", /not active/);
    assert.match(commandBlocker("stopped", true) ?? "", /on first/);
    assert.match(commandBlocker("runningCommand", true) ?? "", /in progress/);
  });
});

describe("command limits", () => {
  it("allows five commands an hour", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const starts = Array.from({ length: 5 }, (_, index) => ({
      action: "command" as const,
      startedAt: new Date(now.getTime() - (index + 1) * 60_000),
    }));
    assert.equal(nextAllowedStart("command", starts.slice(0, 4), now), null);
    const next = nextAllowedStart("command", starts, now);
    assert.equal(next?.toISOString(), "2026-01-01T12:55:00.000Z");
    // Commands do not use up deploys.
    assert.equal(nextAllowedStart("deploy", starts, now), null);
  });
});
