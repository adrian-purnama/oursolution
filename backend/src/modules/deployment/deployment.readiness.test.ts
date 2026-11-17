import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { answered } from "./deployment.readiness";

describe("answered", () => {
  it("counts pages, redirects and sign-in walls as answering", () => {
    for (const status of [200, 204, 301, 302, 401, 403]) {
      assert.equal(answered(status), true, String(status));
    }
  });

  it("does not count the proxy's errors while the service starts", () => {
    for (const status of [404, 500, 502, 503, 504, 521, 530]) {
      assert.equal(answered(status), false, String(status));
    }
  });
});
