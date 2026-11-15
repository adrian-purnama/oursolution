import { env } from "../../environment/env";
import { logger } from "../../logger/logger";

const SOURCE = "modules/llm/llm.service.ts";
const CHAT_PATH = "/v1/chat/completions";

export type LlmRole = "system" | "user" | "assistant";

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export interface LlmChatInput {
  messages: LlmMessage[];
  maxTokens?: number;
  timeoutMs?: number;
}

export const LLM_ERROR_CODES = [
  "UNAVAILABLE",
  "TIMEOUT",
  "HTTP_ERROR",
  "BAD_RESPONSE",
  "EMPTY",
] as const;
export type LlmErrorCode = (typeof LLM_ERROR_CODES)[number];

/** Any failure of a chat call. The message never holds prompt or reply text. */
export class LlmError extends Error {
  constructor(
    readonly code: LlmErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface LlmServiceConfig {
  /** Without a trailing slash; null turns the service off (UNAVAILABLE). */
  baseUrl: string | null;
  model: string;
  timeoutMs: number;
  maxTokens: number;
}

/** What other services depend on, so tests can pass a stub. */
export interface LlmClient {
  chat(input: LlmChatInput): Promise<string>;
}

function contentOf(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: unknown } | null)?.message;
  if (!message || typeof message !== "object") return null;
  const content = (message as { content?: unknown }).content;
  if (content === null || content === undefined) return "";
  return typeof content === "string" ? content : null;
}

/**
 * One OpenAI-compatible chat completion: no streaming, no retries. Knows
 * nothing about what it is used for.
 */
export class LlmService implements LlmClient {
  constructor(private readonly config: LlmServiceConfig) {}

  async chat(input: LlmChatInput): Promise<string> {
    const started = Date.now();
    try {
      const text = await this.request(input);
      this.log("ok", started);
      return text;
    } catch (error) {
      const failure =
        error instanceof LlmError
          ? error
          : new LlmError("BAD_RESPONSE", "Unexpected failure");
      this.log(failure.code, started);
      throw failure;
    }
  }

  private async request(input: LlmChatInput): Promise<string> {
    const { baseUrl, model } = this.config;
    if (!baseUrl) {
      throw new LlmError("UNAVAILABLE", "LLM_BASE_URL is not set");
    }
    const timeoutMs = input.timeoutMs ?? this.config.timeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}${CHAT_PATH}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: input.messages,
            max_tokens: input.maxTokens ?? this.config.maxTokens,
          }),
          signal: controller.signal,
        });
      } catch {
        if (controller.signal.aborted) {
          throw new LlmError("TIMEOUT", "The model did not answer in time");
        }
        throw new LlmError("UNAVAILABLE", "The model could not be reached");
      }
      if (!response.ok) {
        // Drain so the connection can be reused; the body is not logged.
        await response.body?.cancel().catch(() => undefined);
        throw new LlmError(
          "HTTP_ERROR",
          `The model answered HTTP ${response.status}`,
        );
      }
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        if (controller.signal.aborted) {
          throw new LlmError("TIMEOUT", "The model did not answer in time");
        }
        throw new LlmError("BAD_RESPONSE", "The model's answer is not JSON");
      }
      const content = contentOf(body);
      if (content === null) {
        throw new LlmError("BAD_RESPONSE", "The model's answer has no content");
      }
      const text = content.trim();
      if (!text) throw new LlmError("EMPTY", "The model returned no text");
      return text;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Outcome and duration only: never prompt or reply text. */
  private log(outcome: string, started: number): void {
    const message = `LLM chat ${outcome} in ${Date.now() - started} ms`;
    if (outcome === "ok") logger.info(message, SOURCE, "chat");
    else logger.warn(message, SOURCE, "chat");
  }
}

export const llmService = new LlmService({
  baseUrl: env.llmBaseUrl,
  model: env.llmModel,
  timeoutMs: env.llmTimeoutMs,
  maxTokens: env.llmMaxTokens,
});
