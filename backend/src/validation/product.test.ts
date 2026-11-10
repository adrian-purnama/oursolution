import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCreateProductDto, parseUpdateProductDto } from "./product";

const base = { name: "n8n", color: "#1a5c4a", priceIdr: 1000 };

describe("parseCreateProductDto", () => {
  it("defaults to a subscription with a 30-day duration and no link", () => {
    const dto = parseCreateProductDto({
      ...base,
      accessUrl: "https://example.com/x",
    });
    assert.equal(dto.kind, "subscription");
    assert.equal(dto.durationDays, 30);
    assert.equal(dto.accessUrl, null);
  });

  it("gives a one-time product a link and no duration", () => {
    const dto = parseCreateProductDto({
      ...base,
      kind: "oneTime",
      durationDays: 30,
      accessUrl: "https://example.com/workflow",
    });
    assert.equal(dto.durationDays, null);
    assert.equal(dto.accessUrl, "https://example.com/workflow");
  });

  it("rejects an unknown kind and a link that is not http(s)", () => {
    assert.throws(() => parseCreateProductDto({ ...base, kind: "link" }));
    assert.throws(() =>
      parseCreateProductDto({
        ...base,
        kind: "oneTime",
        accessUrl: "javascript:alert(1)",
      }),
    );
  });
});

describe("parseUpdateProductDto", () => {
  it("refuses to change the kind", () => {
    assert.throws(
      () => parseUpdateProductDto({ kind: "oneTime" }, "subscription"),
      /cannot be changed/,
    );
  });

  it("ignores fields that do not apply to the kind", () => {
    const patch = parseUpdateProductDto(
      { name: "x", durationDays: 7, accessUrl: "https://example.com" },
      "oneTime",
    );
    assert.equal(patch.durationDays, undefined);
    assert.equal(patch.accessUrl, "https://example.com/");
  });
});
