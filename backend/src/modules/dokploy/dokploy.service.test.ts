import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dokployUrl } from "../../environment/env";
import {
  containersOutcome,
  containersState,
  deploymentOutcome,
  parseDokployProjects,
  pickEnvironment,
} from "./dokploy.service";

describe("parseDokployProjects", () => {
  it("keeps id, name and description, sorted by name", () => {
    const projects = parseDokployProjects([
      { projectId: "b", name: "materio", description: null, environments: [] },
      { projectId: "a", name: "answr", description: "Plug & Chat" },
      { name: "no id" },
      "junk",
    ]);
    assert.deepEqual(projects, [
      { id: "a", name: "answr", description: "Plug & Chat" },
      { id: "b", name: "materio", description: "" },
    ]);
  });

  it("rejects an answer that is not a list", () => {
    assert.throws(() => parseDokployProjects({ message: "Unauthorized" }));
  });
});

describe("dokployUrl", () => {
  it("drops a trailing slash or /api and treats empty as unset", () => {
    assert.equal(dokployUrl("https://d.example.com/"), "https://d.example.com");
    assert.equal(
      dokployUrl(" https://d.example.com/api/ "),
      "https://d.example.com",
    );
    assert.equal(dokployUrl(""), null);
    assert.equal(dokployUrl(undefined), null);
  });
});

describe("pickEnvironment", () => {
  it("prefers the default environment and lists its composes", () => {
    const environment = pickEnvironment({
      environments: [
        { environmentId: "e1", name: "staging", compose: [] },
        {
          environmentId: "e2",
          name: "production",
          isDefault: true,
          compose: [
            { composeId: "c1", name: "n8n-jo", appName: "n8n-jo-ab12" },
          ],
        },
      ],
    });
    assert.deepEqual(environment, {
      environmentId: "e2",
      composes: [{ composeId: "c1", name: "n8n-jo", appName: "n8n-jo-ab12" }],
    });
    assert.equal(pickEnvironment({ environments: [] }), null);
  });
});

describe("deploymentOutcome", () => {
  const since = new Date("2026-11-10T10:00:00Z");

  it("waits until the deployment started now is listed and finished", () => {
    const old = { status: "error", createdAt: "2026-11-09T10:00:00Z" };
    assert.deepEqual(deploymentOutcome([old], since), { status: "pending" });
    assert.deepEqual(
      deploymentOutcome(
        [old, { status: "running", createdAt: "2026-11-10T10:00:03Z" }],
        since,
      ),
      { status: "pending" },
    );
    assert.deepEqual(
      deploymentOutcome(
        [{ status: "done", createdAt: "2026-11-10T10:00:03Z" }],
        since,
      ),
      { status: "done" },
    );
  });

  it("passes on Dokploy's reason for a failure", () => {
    assert.deepEqual(
      deploymentOutcome(
        [
          {
            status: "error",
            errorMessage: "pull access denied",
            createdAt: "2026-11-10T10:00:03Z",
          },
        ],
        since,
      ),
      { status: "error", message: "pull access denied" },
    );
  });
});

describe("containersState", () => {
  const up = { name: "n8n-1", state: "running", status: "Up 3 hours" };

  it("is running while containers are up, one-off jobs aside", () => {
    assert.equal(containersState([up]), "running");
    assert.equal(
      containersState([
        up,
        {
          name: "migrate-1",
          state: "exited",
          status: "Exited (0) 3 hours ago",
        },
      ]),
      "running",
    );
  });

  it("is stopped when nothing runs, whatever the exit codes", () => {
    assert.equal(containersState([]), "stopped");
    assert.equal(containersState("junk"), "stopped");
    assert.equal(
      containersState([
        { name: "n8n-1", state: "exited", status: "Exited (137) 1 minute ago" },
      ]),
      "stopped",
    );
  });

  it("is degraded when part of it died or keeps restarting", () => {
    assert.equal(
      containersState([
        up,
        { name: "db-1", state: "exited", status: "Exited (1) 1 minute ago" },
      ]),
      "degraded",
    );
    assert.equal(
      containersState([up, { name: "db-1", state: "dead" }]),
      "degraded",
    );
    assert.equal(
      containersState([{ name: "n8n-1", state: "restarting" }]),
      "degraded",
    );
  });
});

describe("containersOutcome", () => {
  it("is done only when every container exited with code 0", () => {
    assert.deepEqual(containersOutcome([]), { status: "missing" });
    assert.deepEqual(
      containersOutcome([{ name: "wipe-1", state: "running", status: "Up" }]),
      { status: "running" },
    );
    assert.deepEqual(
      containersOutcome([
        { name: "wipe-1", state: "exited", status: "Exited (0) 2 seconds ago" },
      ]),
      { status: "done" },
    );
  });

  it("fails on a non-zero or unknown exit code", () => {
    assert.equal(
      containersOutcome([
        { name: "wipe-1", state: "exited", status: "Exited (1) 2 seconds ago" },
      ]).status,
      "error",
    );
    assert.equal(
      containersOutcome([{ name: "wipe-1", state: "exited" }]).status,
      "error",
    );
  });
});
