import type {
  BroadcastAudienceInDto,
  SendBroadcastInDto,
} from "../dto/broadcast.dto";
import {
  DEPLOYMENT_STATES,
  type DeploymentState,
} from "../models/deployment/deployment.interface";
import {
  BODY_MAX as IN_APP_BODY_MAX,
  INVISIBLE,
  TITLE_MAX as IN_APP_TITLE_MAX,
  parseNotificationLink,
} from "./notification";

export const SUBJECT_MAX = 150;
export const BROADCAST_BODY_MAX = 5000;
export const BUTTON_LABEL_MAX = 40;
/** Most users one "users" audience may list. */
export const MAX_PICKED_USERS = 500;

const OBJECT_ID = /^[0-9a-f]{24}$/i;

function length(text: string): number {
  return [...text].length;
}

function line(value: unknown, label: string, max: number): string {
  if (typeof value !== "string") throw new Error(`${label} is required`);
  const text = value
    .normalize("NFC")
    .replace(INVISIBLE, "")
    .replace(/\s+/gu, " ")
    .trim();
  if (length(text) < 1 || length(text) > max) {
    throw new Error(`${label} must be 1 to ${max} characters`);
  }
  return text;
}

function paragraphs(value: unknown, max: number): string {
  if (typeof value !== "string") throw new Error("The message is required");
  const text = value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(INVISIBLE, "")
    .replace(/\t/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (length(text) < 1 || length(text) > max) {
    throw new Error(`The message must be 1 to ${max} characters`);
  }
  return text;
}

function objectId(value: unknown, label: string): string {
  if (typeof value !== "string" || !OBJECT_ID.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value.toLowerCase();
}

export function parseBroadcastAudience(value: unknown): BroadcastAudienceInDto {
  if (!value || typeof value !== "object") {
    throw new Error("Choose who gets the email");
  }
  const raw = value as Record<string, unknown>;
  if (raw.type === "all") return { type: "all" };

  if (raw.type === "users") {
    if (!Array.isArray(raw.userIds) || raw.userIds.length === 0) {
      throw new Error("Pick at least one user");
    }
    const ids = new Set(raw.userIds.map((id) => objectId(id, "user id")));
    if (ids.size > MAX_PICKED_USERS) {
      throw new Error(`Pick at most ${MAX_PICKED_USERS} users`);
    }
    return { type: "users", userIds: [...ids] };
  }

  if (raw.type === "product") {
    const productId = objectId(raw.productId, "product id");
    if (raw.match === "active") return { type: "product", productId, match: "active" };
    if (raw.match === "deployment") {
      if (!Array.isArray(raw.states) || raw.states.length === 0) {
        throw new Error("Pick at least one deployment state");
      }
      const states = new Set<DeploymentState>();
      for (const state of raw.states) {
        if (!(DEPLOYMENT_STATES as readonly unknown[]).includes(state)) {
          throw new Error("Invalid deployment state");
        }
        states.add(state as DeploymentState);
      }
      return { type: "product", productId, match: "deployment", states: [...states] };
    }
    throw new Error('match must be "active" or "deployment"');
  }

  throw new Error('Audience type must be "all", "users" or "product"');
}

export function parseSendBroadcastInDto(body: unknown): SendBroadcastInDto {
  if (!body || typeof body !== "object") throw new Error("Invalid request body");
  const raw = body as Record<string, unknown>;
  const inApp = raw.inApp === true;

  const subject = line(raw.subject, "The subject", SUBJECT_MAX);
  const message = paragraphs(raw.body, BROADCAST_BODY_MAX);
  if (inApp && length(subject) > IN_APP_TITLE_MAX) {
    throw new Error(
      `For an in-app notification the subject must be at most ${IN_APP_TITLE_MAX} characters`,
    );
  }
  if (inApp && length(message) > IN_APP_BODY_MAX) {
    throw new Error(
      `For an in-app notification the message must be at most ${IN_APP_BODY_MAX} characters`,
    );
  }

  const link = parseNotificationLink(raw.link);
  const label =
    raw.buttonLabel === undefined || raw.buttonLabel === null || raw.buttonLabel === ""
      ? null
      : line(raw.buttonLabel, "The button label", BUTTON_LABEL_MAX);

  return {
    subject,
    body: message,
    link,
    buttonLabel: link ? label : null,
    inApp,
    audience: parseBroadcastAudience(raw.audience),
  };
}
