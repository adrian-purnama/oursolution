import {
  TICKET_STATUSES,
  type TicketStatus,
} from "../models/ticket/ticket.interface";

export const SUBJECT_MIN = 5;
export const SUBJECT_MAX = 120;
export const BODY_MIN = 1;
export const BODY_MAX = 2000;
const SEARCH_MAX = 100;
export const PAGE_SIZE = 20;

/**
 * Control characters (tab and newline aside), zero-width characters and
 * bidirectional overrides: invisible, and able to make text read other
 * than it is.
 */
export const INVISIBLE =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

function length(text: string): number {
  return [...text].length;
}

/**
 * Plain text as typed, made safe to store: invisible characters removed,
 * line ends unified, trailing spaces dropped, at most two blank lines in a
 * row. HTML is kept as text; the frontend never renders it as HTML.
 */
export function cleanBody(
  value: unknown,
  label = "The message",
  max = BODY_MAX,
): string {
  if (typeof value !== "string") throw new Error(`${label} is required`);
  const text = value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(INVISIBLE, "")
    .replace(/\t/g, "  ")
    .split("\n")
    .map((line) => line.replace(/\s+$/u, ""))
    .join("\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  if (length(text) < BODY_MIN) throw new Error(`${label} is required`);
  if (length(text) > max) {
    throw new Error(`${label} must be at most ${max} characters`);
  }
  return text;
}

/** One line: every run of whitespace becomes one space. */
export function cleanSubject(value: unknown): string {
  if (typeof value !== "string") throw new Error("The subject is required");
  const text = value
    .normalize("NFC")
    .replace(INVISIBLE, "")
    .replace(/\s+/gu, " ")
    .trim();
  if (length(text) < SUBJECT_MIN || length(text) > SUBJECT_MAX) {
    throw new Error(
      `The subject must be ${SUBJECT_MIN} to ${SUBJECT_MAX} characters`,
    );
  }
  return text;
}

export function parseCreateTicketInDto(body: unknown): {
  subject: string;
  description: string;
} {
  const raw = (body ?? {}) as Record<string, unknown>;
  return {
    subject: cleanSubject(raw.subject),
    description: cleanBody(raw.description, "The description"),
  };
}

export function parseTicketMessageInDto(body: unknown): { body: string } {
  const raw = (body ?? {}) as Record<string, unknown>;
  return { body: cleanBody(raw.body) };
}

export const RESOLUTION_MAX = 1000;
const OBJECT_ID = /^[0-9a-f]{24}$/i;

export interface CloseTicketInput {
  /** Null for "Other". */
  productId: string | null;
  resolution: string;
  summarize: boolean;
}

export function parseCloseTicketInDto(body: unknown): CloseTicketInput {
  const raw = (body ?? {}) as Record<string, unknown>;
  const { productId, summarize } = raw;
  if (
    productId !== null &&
    (typeof productId !== "string" || !OBJECT_ID.test(productId))
  ) {
    throw new Error("Choose a product or Other");
  }
  if (typeof summarize !== "boolean") {
    throw new Error("summarize must be true or false");
  }
  return {
    productId,
    resolution: cleanBody(raw.resolution, "The resolution", RESOLUTION_MAX),
    summarize,
  };
}

export function parseTicketStatus(value: unknown): TicketStatus {
  if (!TICKET_STATUSES.includes(value as TicketStatus)) {
    throw new Error(`Status must be one of ${TICKET_STATUSES.join(", ")}`);
  }
  return value as TicketStatus;
}

function first(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

export function parsePage(value: unknown): number {
  const page = Number(first(value) ?? 1);
  return Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1;
}

export function parseTicketListQuery(query: Record<string, unknown>): {
  page: number;
  status: TicketStatus | null;
  search: string;
} {
  const status = first(query.status);
  const search = first(query.q);
  return {
    page: parsePage(query.page),
    status:
      typeof status === "string" && status !== "" && status !== "all"
        ? parseTicketStatus(status)
        : null,
    search:
      typeof search === "string"
        ? search.replace(INVISIBLE, "").trim().slice(0, SEARCH_MAX)
        : "",
  };
}
