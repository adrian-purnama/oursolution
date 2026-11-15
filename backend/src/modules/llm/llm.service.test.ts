import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, describe, it } from "node:test";
import { LlmError, LlmService, type LlmErrorCode } from "./llm.service";

type Handler = (
  req: IncomingMessage,
  body: string,
) => { status?: number; body?: string; delayMs?: number };

let server: Server;
let base: string;
let handler: Handler;
let seen: {
  method?: string;
  url?: string;
  type?: string;
  auth?: string;
  body: string;
}[];

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk: Buffer) => (raw += chunk.toString("utf8")));
    req.on("end", () => {
      seen.push({
        method: req.method,
        url: req.url,
        type: req.headers["content-type"],
        auth: req.headers.authorization,
        body: raw,
      });
      const reply = handler(req, raw);
      const send = () => {
        if (res.destroyed) return;
        res.writeHead(reply.status ?? 200, {
          "Content-Type": "application/json",
        });
        res.end(reply.body ?? "");
      };
      if (reply.delayMs) setTimeout(send, reply.delayMs);
      else send();
    });
  });
  server.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  seen = [];
  handler = () => ({ body: completion("  Hello there \n") });
});

function completion(content: unknown): string {
  return JSON.stringify({
    choices: [{ message: { role: "assistant", content } }],
  });
}

function service(
  overrides: Partial<{
    baseUrl: string | null;
    apiKey: string | null;
    timeoutMs: number;
  }> = {},
) {
  return new LlmService({
    baseUrl: base,
    apiKey: "test-key",
    model: "deepseek-chat",
    timeoutMs: 2_000,
    maxTokens: 512,
    ...overrides,
  });
}

async function failsWith(promise: Promise<unknown>, code: LlmErrorCode) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof LlmError, String(error));
    assert.equal(error.code, code);
    return true;
  });
}

const messages = [{ role: "user" as const, content: "secret words" }];

describe("llmService.chat", () => {
  it("posts model, messages and max_tokens, and returns trimmed text", async () => {
    const text = await service().chat({ messages, maxTokens: 64 });
    assert.equal(text, "Hello there");
    assert.equal(seen.length, 1);
    assert.equal(seen[0]!.method, "POST");
    assert.equal(seen[0]!.url, "/v1/chat/completions");
    assert.match(seen[0]!.type ?? "", /application\/json/);
    assert.equal(seen[0]!.auth, "Bearer test-key");
    assert.deepEqual(JSON.parse(seen[0]!.body), {
      model: "deepseek-chat",
      messages,
      max_tokens: 64,
    });
  });

  it("uses the configured max_tokens by default", async () => {
    await service().chat({ messages });
    assert.equal(JSON.parse(seen[0]!.body).max_tokens, 512);
  });

  it("times out", async () => {
    handler = () => ({ body: completion("late"), delayMs: 500 });
    await failsWith(service().chat({ messages, timeoutMs: 50 }), "TIMEOUT");
  });

  it("rejects a non-2xx answer", async () => {
    handler = () => ({ status: 503, body: "{}" });
    await failsWith(service().chat({ messages }), "HTTP_ERROR");
  });

  it("rejects malformed JSON and a missing message", async () => {
    handler = () => ({ body: "not json{" });
    await failsWith(service().chat({ messages }), "BAD_RESPONSE");
    handler = () => ({ body: JSON.stringify({ choices: [] }) });
    await failsWith(service().chat({ messages }), "BAD_RESPONSE");
    handler = () => ({ body: completion(42) });
    await failsWith(service().chat({ messages }), "BAD_RESPONSE");
  });

  it("rejects empty content", async () => {
    handler = () => ({ body: completion("   \n ") });
    await failsWith(service().chat({ messages }), "EMPTY");
    handler = () => ({ body: completion(null) });
    await failsWith(service().chat({ messages }), "EMPTY");
  });

  it("is unavailable without a base URL, without calling anything", async () => {
    await failsWith(
      service({ baseUrl: null }).chat({ messages }),
      "UNAVAILABLE",
    );
    assert.equal(seen.length, 0);
  });

  it("is unavailable without an API key, without calling anything", async () => {
    await failsWith(
      service({ apiKey: null }).chat({ messages }),
      "UNAVAILABLE",
    );
    assert.equal(seen.length, 0);
  });

  it("never puts the API key in the error", async () => {
    handler = () => ({
      status: 401,
      body: JSON.stringify({ key: "test-key" }),
    });
    await assert.rejects(service().chat({ messages }), (error: Error) => {
      assert.doesNotMatch(error.message, /test-key/);
      return true;
    });
  });

  it("is unavailable when nothing listens", async () => {
    await failsWith(
      service({ baseUrl: "http://127.0.0.1:1" }).chat({ messages }),
      "UNAVAILABLE",
    );
  });

  it("never puts message content in the error", async () => {
    handler = () => ({
      status: 500,
      body: JSON.stringify({ echo: "secret words" }),
    });
    await assert.rejects(service().chat({ messages }), (error: Error) => {
      assert.doesNotMatch(error.message, /secret/);
      return true;
    });
  });
});
