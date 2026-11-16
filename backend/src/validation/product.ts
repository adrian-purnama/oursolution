import { Types } from "mongoose";
import type { GrantPurchaseInDto } from "../dto/purchase.dto";
import {
  DEPLOYMENT_TYPES,
  MAX_PRODUCT_IMAGES,
  NOTICE_TONES,
  PRODUCT_KINDS,
  type NoticeTone,
  type ProductNotice,
  VARIABLE_VISIBILITIES,
  type DeploymentDomain,
  type DeploymentType,
  type DeploymentVariable,
  type ProductDeployment,
  type ProductKind,
  type VariableVisibility,
} from "../models/product/product.interface";
import type {
  CreateProductDto,
  ReorderProductImagesDto,
  UpdateProductDto,
} from "../dto/product.dto";
import { env } from "../environment/env";
import { checkDeployment, type DeploymentDraft } from "../utils/deployment";
import type { AssignProductDto, PeriodEndSpec } from "../dto/userProduct.dto";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const MAX_NAME_LENGTH = 60;
const MAX_PRICING_TEXT_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 4000;
const MAX_NOTICES = 20;
const MAX_NOTICE_LENGTH = 1000;
const MAX_PRICE_IDR = 1_000_000_000_000;
const MAX_DURATION_DAYS = 36_500;
const MAX_URL_LENGTH = 2000;
const MAX_COMPOSE_LENGTH = 100_000;
const DOKPLOY_ID = /^[A-Za-z0-9_-]{1,100}$/;
const MAX_HOST_LENGTH = 253;
const MAX_VARIABLES = 100;
const MAX_DOMAINS = 20;
const MAX_VARIABLE_KEY_LENGTH = 100;
const MAX_VARIABLE_VALUE_LENGTH = 4000;

function asRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Invalid request body");
  }
  return body as Record<string, unknown>;
}

function parseName(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("name is required");
  }
  const name = value.trim();
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`name must be at most ${MAX_NAME_LENGTH} characters`);
  }
  return name;
}

function parseColor(value: unknown): string {
  if (typeof value !== "string" || !HEX_COLOR.test(value)) {
    throw new Error("color must be a hex color such as #1a5c4a");
  }
  return value.toLowerCase();
}

function parsePricingText(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("pricingText must be text");
  }
  const text = value.trim();
  if (text.length > MAX_PRICING_TEXT_LENGTH) {
    throw new Error(
      `pricingText must be at most ${MAX_PRICING_TEXT_LENGTH} characters`,
    );
  }
  return text;
}

/** Multi-line text; line breaks are kept, the ends trimmed. */
function parseDescription(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("description must be text");
  }
  const text = value.trim();
  if (text.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(
      `description must be at most ${MAX_DESCRIPTION_LENGTH} characters`,
    );
  }
  return text;
}

/** A list of `{ tone, text }`; text is Markdown, trimmed, never empty. */
function parseNotices(value: unknown): ProductNotice[] {
  if (!Array.isArray(value)) throw new Error("notices must be a list");
  if (value.length > MAX_NOTICES) {
    throw new Error(`At most ${MAX_NOTICES} notices`);
  }
  return value.map((item: unknown, index) => {
    const raw = asRecord(item);
    const at = `Notice ${index + 1}`;
    if (!NOTICE_TONES.includes(raw.tone as NoticeTone)) {
      throw new Error(`${at}: tone must be one of ${NOTICE_TONES.join(", ")}`);
    }
    if (typeof raw.text !== "string" || !raw.text.trim()) {
      throw new Error(`${at} needs text`);
    }
    const text = raw.text.trim();
    if (text.length > MAX_NOTICE_LENGTH) {
      throw new Error(`${at} must be at most ${MAX_NOTICE_LENGTH} characters`);
    }
    return { tone: raw.tone as NoticeTone, text };
  });
}

function parsePriceIdr(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > MAX_PRICE_IDR
  ) {
    throw new Error("priceIdr must be a whole number of rupiah, 0 or more");
  }
  return value;
}

function parseDays(value: unknown, field: string): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_DURATION_DAYS
  ) {
    throw new Error(`${field} must be a whole number of days, 1 or more`);
  }
  return value;
}

function parseKind(value: unknown): ProductKind {
  if (!PRODUCT_KINDS.includes(value as ProductKind)) {
    throw new Error(`kind must be one of ${PRODUCT_KINDS.join(", ")}`);
  }
  return value as ProductKind;
}

/** An http(s) link, or null to clear it. */
function parseAccessUrl(value: unknown): string | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.length > MAX_URL_LENGTH) {
    throw new Error("accessUrl must be a link");
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("accessUrl must be a full link, such as https://�");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("accessUrl must start with http:// or https://");
  }
  return url.toString();
}

function parseText(value: unknown, field: string, max: number): string {
  if (typeof value !== "string") throw new Error(`${field} must be text`);
  if (value.length > max) throw new Error(`${field} is too long`);
  return value;
}

function parseList(value: unknown, field: string, max: number): unknown[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`${field} must be a list`);
  if (value.length > max) {
    throw new Error(`${field} can have at most ${max} entries`);
  }
  return value;
}

function parseVariable(value: unknown): DeploymentVariable {
  const raw = asRecord(value);
  if (!VARIABLE_VISIBILITIES.includes(raw.visibility as VariableVisibility)) {
    throw new Error(
      `variable visibility must be one of ${VARIABLE_VISIBILITIES.join(", ")}`,
    );
  }
  return {
    key: parseText(raw.key, "variable name", MAX_VARIABLE_KEY_LENGTH).trim(),
    value: parseText(
      raw.value ?? "",
      "variable value",
      MAX_VARIABLE_VALUE_LENGTH,
    ),
    visibility: raw.visibility as VariableVisibility,
  };
}

function parseDomain(value: unknown): DeploymentDomain {
  const raw = asRecord(value);
  const port =
    typeof raw.port === "number"
      ? raw.port
      : typeof raw.port === "string" && raw.port.trim()
        ? Number(raw.port)
        : Number.NaN;
  return {
    serviceName: parseText(
      raw.serviceName ?? "",
      "service",
      MAX_NAME_LENGTH,
    ).trim(),
    subdomain: parseText(
      raw.subdomain ?? "",
      "subdomain",
      MAX_HOST_LENGTH,
    ).trim(),
    port,
  };
}

/**
 * Body: `{ name, composeFile, variables?, domains? }` as typed. Only the
 * shape is checked here; `checkDeployment` judges the content.
 */
export function parseDeploymentDraft(body: unknown): DeploymentDraft {
  const raw = asRecord(body);
  return {
    name: parseText(raw.name ?? "", "name", MAX_NAME_LENGTH * 2),
    composeFile: parseText(
      raw.composeFile,
      "The compose file",
      MAX_COMPOSE_LENGTH,
    ),
    variables: parseList(raw.variables, "variables", MAX_VARIABLES).map(
      parseVariable,
    ),
    domains: parseList(raw.domains, "domains", MAX_DOMAINS).map(parseDomain),
  };
}

/**
 * Null for no deployment. Otherwise it needs a Dokploy project and settings
 * that pass `checkDeployment`; the compose file is stored re-indented.
 * Warnings do not block.
 */
function parseDeployment(value: unknown): ProductDeployment | null {
  if (value === null) return null;
  const raw = asRecord(value);
  if (!DEPLOYMENT_TYPES.includes(raw.type as DeploymentType)) {
    throw new Error(
      `deployment.type must be one of ${DEPLOYMENT_TYPES.join(", ")}`,
    );
  }
  if (typeof raw.projectId !== "string" || !DOKPLOY_ID.test(raw.projectId)) {
    throw new Error("Choose the Dokploy project to deploy into");
  }
  const draft = parseDeploymentDraft(raw);
  const check = checkDeployment(draft, env.deployDomain ?? undefined);
  const errors = check.issues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) {
    const [first] = errors;
    const where =
      first.file === "settings"
        ? ""
        : `Compose file${first.line ? ` line ${first.line}` : ""}: `;
    const more = errors.length > 1 ? ` (and ${errors.length - 1} more)` : "";
    throw new Error(`${where}${first.message}${more}`);
  }
  return {
    type: raw.type as DeploymentType,
    projectId: raw.projectId,
    name: draft.name.trim(),
    composeFile: check.composeFile,
    variables: draft.variables,
    domains: draft.domains,
  };
}

function parseBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${field} must be true or false`);
  }
  return value;
}

function parseObjectId(value: unknown, field: string): string {
  if (typeof value !== "string" || !Types.ObjectId.isValid(value)) {
    throw new Error(`${field} is required`);
  }
  return value;
}

/**
 * A subscription needs a duration, may have a deployment and has no access
 * link; a one-time product is the other way round. Fields that do not apply are stored as null.
 */
export function parseCreateProductDto(body: unknown): CreateProductDto {
  const raw = asRecord(body);
  const kind = parseKind(raw.kind ?? "subscription");
  return {
    name: parseName(raw.name),
    kind,
    color: parseColor(raw.color),
    pricingText: parsePricingText(raw.pricingText ?? ""),
    description: parseDescription(raw.description ?? ""),
    notices: parseNotices(raw.notices ?? []),
    priceIdr: parsePriceIdr(raw.priceIdr),
    durationDays:
      kind === "subscription"
        ? parseDays(raw.durationDays ?? 30, "durationDays")
        : null,
    deployment:
      kind === "subscription" ? parseDeployment(raw.deployment ?? null) : null,
    accessUrl:
      kind === "oneTime" ? parseAccessUrl(raw.accessUrl ?? null) : null,
    showOnPricingPage: parseBoolean(
      raw.showOnPricingPage ?? false,
      "showOnPricingPage",
    ),
  };
}

/** Which fields apply depends on the product's kind, which cannot change. */
export function parseUpdateProductDto(
  body: unknown,
  kind: ProductKind,
): UpdateProductDto {
  const raw = asRecord(body);
  const patch: UpdateProductDto = {};

  if ("kind" in raw && raw.kind !== kind) {
    throw new Error("A product's kind cannot be changed");
  }

  if ("name" in raw) patch.name = parseName(raw.name);
  if ("color" in raw) patch.color = parseColor(raw.color);
  if ("pricingText" in raw) {
    patch.pricingText = parsePricingText(raw.pricingText);
  }
  if ("description" in raw) {
    patch.description = parseDescription(raw.description);
  }
  if ("notices" in raw) patch.notices = parseNotices(raw.notices);
  if ("priceIdr" in raw) patch.priceIdr = parsePriceIdr(raw.priceIdr);
  if ("durationDays" in raw && kind === "subscription") {
    patch.durationDays = parseDays(raw.durationDays, "durationDays");
  }
  if ("deployment" in raw && kind === "subscription") {
    patch.deployment = parseDeployment(raw.deployment);
  }
  if ("accessUrl" in raw && kind === "oneTime") {
    patch.accessUrl = parseAccessUrl(raw.accessUrl);
  }
  if ("showOnPricingPage" in raw) {
    patch.showOnPricingPage = parseBoolean(
      raw.showOnPricingPage,
      "showOnPricingPage",
    );
  }

  if (Object.keys(patch).length === 0) {
    throw new Error("No valid fields to update");
  }
  return patch;
}

/**
 * Body: `{ productId, durationDays? | endsAt? | untilCurrentEnd? }`. With none
 * of the three, the period has no end.
 */
export function parseAssignProductDto(body: unknown): AssignProductDto {
  const raw = asRecord(body);
  const productId = parseObjectId(raw.productId, "productId");

  const given = ["durationDays", "endsAt", "untilCurrentEnd"].filter(
    (key) => raw[key] !== undefined && raw[key] !== null && raw[key] !== false,
  );
  if (given.length > 1) {
    throw new Error("Give only one of durationDays, endsAt or untilCurrentEnd");
  }

  let end: PeriodEndSpec = { kind: "none" };

  if (given[0] === "durationDays") {
    end = { kind: "days", days: parseDays(raw.durationDays, "durationDays") };
  } else if (given[0] === "endsAt") {
    const at = typeof raw.endsAt === "string" ? new Date(raw.endsAt) : null;
    if (!at || Number.isNaN(at.getTime())) {
      throw new Error("endsAt must be a date");
    }
    end = { kind: "date", at };
  } else if (given[0] === "untilCurrentEnd") {
    if (raw.untilCurrentEnd !== true) {
      throw new Error("untilCurrentEnd must be true when given");
    }
    end = { kind: "currentEnd" };
  }

  return { productId, end };
}

/** Body: `{ productId }`. */
export function parseGrantPurchaseInDto(body: unknown): GrantPurchaseInDto {
  const raw = asRecord(body);
  return { productId: parseObjectId(raw.productId, "productId") };
}

/** Body of the image reorder: a list of image ids. Membership is checked later. */
export function parseReorderImagesDto(body: unknown): ReorderProductImagesDto {
  const { ids } = asRecord(body);
  if (
    !Array.isArray(ids) ||
    ids.length > MAX_PRODUCT_IMAGES ||
    !ids.every((id) => typeof id === "string" && Types.ObjectId.isValid(id))
  ) {
    throw new Error("ids must be a list of image ids");
  }
  return { ids: ids as string[] };
}
