import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { OtpModel } from "../../models/otp/otp.model";
import { OtpCooldownError, OtpService } from "./otp.service";

const exec = <T>(value: T) => ({ exec: async () => value });

describe("OtpService", () => {
  afterEach(() => mock.restoreAll());

  it("generates six-digit codes", () => {
    const service = new OtpService();
    for (let i = 0; i < 200; i++) {
      assert.match(service.generateOtp(), /^[1-9]\d{5}$/);
    }
  });

  it("stores a hash, never the code itself", async () => {
    let stored: Record<string, unknown> = {};
    mock.method(OtpModel, "findOne", () => exec(null));
    mock.method(OtpModel, "deleteMany", async () => ({}));
    mock.method(OtpModel, "create", async (doc: Record<string, unknown>) => {
      stored = doc;
      return doc;
    });

    const otp = await new OtpService().issue("a@b.com", "register");
    assert.equal(stored.email, "a@b.com");
    assert.equal(stored.purpose, "register");
    assert.notEqual(stored.otpHash, otp);
    assert.equal(JSON.stringify(stored).includes(otp), false);
  });

  it("refuses a second code inside the cooldown", async () => {
    mock.method(OtpModel, "findOne", () => exec({ email: "a@b.com" }));
    await assert.rejects(
      () => new OtpService().issue("a@b.com", "reset"),
      OtpCooldownError,
    );
  });

  it("accepts the right code once and rejects a wrong one", async () => {
    let stored: { otpHash?: string } = {};
    mock.method(OtpModel, "findOne", () => exec(null));
    mock.method(OtpModel, "deleteMany", async () => ({}));
    mock.method(OtpModel, "create", async (doc: { otpHash: string }) => {
      stored = doc;
      return doc;
    });
    const service = new OtpService();
    const otp = await service.issue("a@b.com", "reset");

    mock.method(OtpModel, "findOneAndUpdate", () =>
      exec({ _id: "1", otpHash: stored.otpHash, attempts: 1 }),
    );
    const deleted = mock.method(OtpModel, "findOneAndDelete", () =>
      exec({ _id: "1" }),
    );

    const wrong = otp === "123456" ? "654321" : "123456";
    assert.equal(
      await service.validateAndConsume("a@b.com", wrong, "reset"),
      false,
    );
    assert.equal(deleted.mock.callCount(), 0);

    // A code issued for reset must not work for register.
    assert.equal(
      await service.validateAndConsume("a@b.com", otp, "register"),
      false,
    );

    assert.equal(
      await service.validateAndConsume("a@b.com", otp, "reset"),
      true,
    );
    assert.equal(deleted.mock.callCount(), 1);
  });

  it("rejects once the attempt cap is reached", async () => {
    const filters: Array<Record<string, unknown>> = [];
    mock.method(
      OtpModel,
      "findOneAndUpdate",
      (filter: Record<string, unknown>) => {
        filters.push(filter);
        return exec(null);
      },
    );
    const purge = mock.method(OtpModel, "deleteMany", async () => ({}));

    const ok = await new OtpService().validateAndConsume(
      "a@b.com",
      "111111",
      "reset",
    );
    assert.equal(ok, false);
    assert.deepEqual(filters[0]?.attempts, { $lt: 5 });
    assert.equal(purge.mock.callCount(), 1);
  });
});
