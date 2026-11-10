import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { softDeleteBlocker } from "./product.service";

describe("softDeleteBlocker", () => {
  it("lets a subscription go once nobody has it running or scheduled", () => {
    assert.equal(softDeleteBlocker("subscription", 0), null);
  });

  it("blocks a subscription that is still running or scheduled for someone", () => {
    assert.match(softDeleteBlocker("subscription", 2) ?? "", /2 running/);
  });

  it("always lets a one-time product go, since owners keep it", () => {
    assert.equal(softDeleteBlocker("oneTime", 0), null);
    assert.equal(softDeleteBlocker("oneTime", 5), null);
  });
});
