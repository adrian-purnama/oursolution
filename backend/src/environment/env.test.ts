import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isDevelopmentBuild } from "./env";

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
