import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cloudflareTunnelId,
  isDevelopmentBuild,
  midtransNotificationUrl,
  paddleSandbox,
} from "./env";

describe("midtransNotificationUrl", () => {
  it("builds the URL from the backend's public URL", () => {
    assert.equal(
      midtransNotificationUrl(undefined, "https://api.example.com"),
      "https://api.example.com/payments/midtrans/notification",
    );
  });

  it("lets MIDTRANS_NOTIFICATION_URL win", () => {
    assert.equal(
      midtransNotificationUrl(
        " https://hooks.example.com/midtrans ",
        "https://api.example.com",
      ),
      "https://hooks.example.com/midtrans",
    );
  });

  it("sends nothing for an address Midtrans cannot reach", () => {
    assert.equal(midtransNotificationUrl(undefined, "http://localhost:8000"), null);
    assert.equal(midtransNotificationUrl(undefined, "http://127.0.0.1:8000"), null);
    assert.equal(midtransNotificationUrl(undefined, "http://api.localhost"), null);
    assert.equal(midtransNotificationUrl("", null), null);
  });
});

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

describe("paddleSandbox", () => {
  const SANDBOX = "https://sandbox-api.paddle.com";
  const LIVE = "https://api.paddle.com";

  it("reads the environment from PADDLE_URL", () => {
    assert.equal(paddleSandbox(SANDBOX, "pdl_sdbx_apikey_1", "test_1"), true);
    assert.equal(paddleSandbox(LIVE, "pdl_live_apikey_1", "live_1"), false);
  });

  it("does not matter while Paddle is off", () => {
    assert.equal(paddleSandbox(undefined, undefined, undefined), true);
    assert.equal(paddleSandbox(LIVE, "", "live_1"), true);
  });

  it("refuses to guess when PADDLE_URL is missing", () => {
    assert.throws(
      () => paddleSandbox(undefined, "pdl_sdbx_apikey_1", "test_1"),
      /PADDLE_URL is required/,
    );
  });

  it("refuses keys from the other environment", () => {
    assert.throws(
      () => paddleSandbox(LIVE, "pdl_sdbx_apikey_1", undefined),
      /sandbox key/,
    );
    assert.throws(
      () => paddleSandbox(SANDBOX, "pdl_live_apikey_1", undefined),
      /live key/,
    );
    assert.throws(
      () => paddleSandbox(SANDBOX, "pdl_sdbx_apikey_1", "live_1"),
      /live token/,
    );
  });
});
