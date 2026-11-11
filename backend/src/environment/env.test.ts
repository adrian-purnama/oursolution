import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cloudflareTunnelId, isDevelopmentBuild } from "./env";

describe("isDevelopmentBuild", () => {
  it("accepts development, dev and suffixed variants", () => {
    for (const name of [
      "development",
      "DEVELOPMENT",
      "dev",
      "development-fedier",
      "Development-Fedier",
      "dev-api",
      "development_two",
    ]) {
      assert.equal(isDevelopmentBuild(name), true, name);
    }
  });

  it("rejects everything else", () => {
    for (const name of [
      "production",
      "staging",
      "developmentfedier",
      "development-",
      "devops",
      "prod-development",
    ]) {
      assert.equal(isDevelopmentBuild(name), false, name);
    }
  });
});

describe("cloudflareTunnelId", () => {
  const id = "83a32c25-073c-4231-ba4f-803d4b667325";

  it("takes a UUID, or the ID inside a tunnel token", () => {
    assert.equal(cloudflareTunnelId(` ${id.toUpperCase()} `), id);
    const token = Buffer.from(
      JSON.stringify({ a: "account", t: id, s: "secret" }),
    ).toString("base64");
    assert.equal(cloudflareTunnelId(token), id);
  });

  it("is null when unset or unreadable", () => {
    assert.equal(cloudflareTunnelId(undefined), null);
    assert.equal(cloudflareTunnelId("not-a-tunnel"), null);
  });
});
