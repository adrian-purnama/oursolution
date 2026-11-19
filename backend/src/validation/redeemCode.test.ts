import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCreateRedeemCodesDto, parseRedeemCode } from "./redeemCode";

const now = new Date(Date.UTC(2026, 0, 1));
const productId = "64b7f0c2a1b2c3d4e5f60718";

describe("parseRedeemCode", () => {
  it("ignores case, spaces and dashes", () => {
    assert.equal(
      parseRedeemCode({ code: " abcd efgh-23jk " }),
      "ABCD-EFGH-23JK",
    );
  });

  it("refuses a code of the wrong length", () => {
    assert.throws(() => parseRedeemCode({ code: "ABCD-EFGH" }));
  });
});

describe("parseCreateRedeemCodesDto", () => {
  it("defaults to one code active on redeem", () => {
    const dto = parseCreateRedeemCodesDto({ productId, durationDays: 30 }, now);
    assert.equal(dto.activation, "onRedeem");
    assert.equal(dto.quantity, 1);
    assert.equal(dto.durationDays, 30);
  });

  it("needs a start date when activation is a date", () => {
    assert.throws(() =>
      parseCreateRedeemCodesDto({ productId, activation: "date" }, now),
    );
  });

  it("refuses an end before the start", () => {
    assert.throws(() =>
      parseCreateRedeemCodesDto(
        {
          productId,
          activation: "date",
          activatesAt: "2026-03-01T00:00:00Z",
          endsAt: "2026-02-01T00:00:00Z",
        },
        now,
      ),
    );
  });

  it("refuses a validity already over", () => {
    assert.throws(() =>
      parseCreateRedeemCodesDto(
        { productId, validUntil: "2025-12-01T00:00:00Z" },
        now,
      ),
    );
  });
});
