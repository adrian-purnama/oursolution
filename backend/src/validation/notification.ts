import {
  NOTIFICATION_CHANNELS,
  type NotificationChannels,
} from "../models/notification/notification.interface";

export const TITLE_MAX = 100;
export const BODY_MAX = 500;
export const LINK_MAX = 300;
export const MAX_RECIPIENTS = 500;
export const PAGE_LIMIT_DEFAULT = 20;
export const PAGE_LIMIT_MAX = 50;

/** Thrown for bad input to `notificationService.send`. */
export class NotificationInputError extends Error {}

/**
 * Control characters (tab and newline aside, null bytes included),
 * zero-width characters and bidirectional overrides.
 */
export const INVISIBLE =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

const OBJECT_ID = /^[0-9a-f]{24}$/i;

function isObjectId(value: unknown): value is string {
  return typeof value === "string" && OBJECT_ID.test(value);
}

function length(text: string): number {
  return [...text].length;
}

/** One line of plain text: whitespace runs become one space. */
export function cleanNotificationTitle(value: unknown): string {
  if (typeof value !== "string") {
    throw new NotificationInputError("The title is required");
  }
  const text = value
    .normalize("NFC")
    .replace(INVISIBLE, "")
    .replace(/\s+/gu, " ")
    .trim();
  if (length(text) < 1 || length(text) > TITLE_MAX) {
    throw new NotificationInputError(
      `The title must be 1 to ${TITLE_MAX} characters`,
    );
  }
  return text;
}

/** Plain text; line breaks kept, invisible characters removed. */
export function cleanNotificationBody(value: unknown): string {
  if (typeof value !== "string") {
    throw new NotificationInputError("The body is required");
  }
  const text = value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(INVISIBLE, "")
    .replace(/\t/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (length(text) < 1 || length(text) > BODY_MAX) {
    throw new NotificationInputError(
      `The body must be 1 to ${BODY_MAX} characters`,
    );
  }
  return text;
}

/**
 * True for an internal relative path: one leading "/", no scheme, no
 * protocol-relative "//" or "/\", no whitespace or control characters,
 * at most LINK_MAX characters. The frontend checks the same before use.
 */
export function isSafeInternalLink(value: string): boolean {
  if (value.length < 1 || value.length > LINK_MAX) return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  // Browsers read "\" as "/", so "/\evil.com" would leave the site.
  if (value.includes("\\")) return false;
  if (/[\s\u0000-\u001F\u007F-\u009F]/u.test(value)) return false;
  try {
    const base = "http://internal.invalid";
    return new URL(value, base).origin === base;
  } catch {
    return false;
  }
}

/** Null when absent; otherwise a safe internal path or an error. */
export function parseNotificationLink(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !isSafeInternalLink(value)) {
    throw new NotificationInputError(
      `The link must be a relative path starting with "/" (at most ${LINK_MAX} characters)`,
    );
  }
  return value;
}

function parseChannels(value: unknown): NotificationChannels {
  if (
    typeof value === "string" &&
    (NOTIFICATION_CHANNELS as readonly string[]).includes(value)
  ) {
    return value as NotificationChannels;
  }
  throw new NotificationInputError(
    `channels must be one of ${NOTIFICATION_CHANNELS.join(", ")}`,
  );
}

function parseRecipients(userId: unknown, userIds: unknown): string[] {
  if ((userId === undefined) === (userIds === undefined)) {
    throw new NotificationInputError("Give either userId or userIds");
  }
  const raw = userIds === undefined ? [userId] : userIds;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new NotificationInputError("userIds must be a non-empty list");
  }
  const ids = new Set<string>();
  for (const id of raw) {
    if (!isObjectId(id)) {
      throw new NotificationInputError("Invalid user id");
    }
    ids.add(id.toLowerCase());
  }
  if (ids.size > MAX_RECIPIENTS) {
    throw new NotificationInputError(
      `At most ${MAX_RECIPIENTS} recipients per call`,
    );
  }
  return [...ids];
}

export interface ParsedSendNotification {
  userIds: string[];
  title: string;
  body: string;
  link: string | null;
  channels: NotificationChannels;
}

export function parseSendNotificationInDto(
  input: unknown,
): ParsedSendNotification {
  const raw = (input ?? {}) as Record<string, unknown>;
  return {
    userIds: parseRecipients(raw.userId, raw.userIds),
    title: cleanNotificationTitle(raw.title),
    body: cleanNotificationBody(raw.body),
    link: parseNotificationLink(raw.link),
    channels: parseChannels(raw.channels),
  };
}

function firstString(value: unknown): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? first : undefined;
}

export function parseNotificationListQuery(query: unknown): {
  cursor: string | null;
  limit: number;
} {
  const raw = (query ?? {}) as Record<string, unknown>;
  const cursor = firstString(raw.cursor);
  if (cursor && !isObjectId(cursor)) {
    throw new Error("Invalid cursor");
  }
  const limitText = firstString(raw.limit);
  let limit = PAGE_LIMIT_DEFAULT;
  if (limitText !== undefined && limitText !== "") {
    limit = Number(limitText);
    if (!Number.isInteger(limit) || limit < 1 || limit > PAGE_LIMIT_MAX) {
      throw new Error(`limit must be 1 to ${PAGE_LIMIT_MAX}`);
    }
  }
  return { cursor: cursor || null, limit };
}

/** The Last-Event-ID header when it is a notification id, else null. */
export function parseLastEventId(value: unknown): string | null {
  const id = firstString(value)?.trim();
  return isObjectId(id) ? id : null;
}
