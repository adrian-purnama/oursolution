import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request, Response } from "express";
import { requireAdmin } from "./requireAdmin";

function run(user: unknown): { status: number | null; passed: boolean } {
  const result = { status: null as number | null, passed: false };
  const res = {
    status(code: number) {
      result.status = code;
      return this;
    },
    json() {
      return this;
    },
  } as unknown as Response;
  requireAdmin({ user } as unknown as Request, res, () => {
    result.passed = true;
  });
  return result;
}

describe("requireAdmin", () => {
  it("lets admins through", () => {
    assert.deepEqual(run({ role: "admin" }), { status: null, passed: true });
  });

  it("answers 403 for ordinary users", () => {
    assert.deepEqual(run({ role: "user" }), { status: 403, passed: false });
  });

  it("answers 401 when nobody is signed in", () => {
    assert.deepEqual(run(undefined), { status: 401, passed: false });
  });
});
