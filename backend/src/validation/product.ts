import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import type { GrantPurchaseInDto } from "../dto/purchase.dto";
import {
  DEPLOYMENT_TYPES,
  MAX_DEPLOYMENT_COMMANDS,
  MAX_PRODUCT_IMAGES,
  MAX_PRODUCT_VARIANTS,
  type ProductVariant,
  type VariantDeployment,
  NOTICE_TONES,
  PRODUCT_KINDS,
  type NoticeTone,
  type ProductNotice,
  VARIABLE_VISIBILITIES,
  type DeploymentCommand,
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
import {
  checkDeployment,
  checkErrorMessage,
  type DeploymentDraft,
} from "../utils/deployment";
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
const MAX_COMMAND_LABEL_LENGTH = 60;
const MAX_COMMAND_LENGTH = 2000;
const COMMAND_ID = /^[A-Za-z0-9_-]{1,40}$/;
const VARIANT_ID = /^[A-Za-z0-9_-]{1,40}$/;
const MAX_SPECS_LENGTH = 300;

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

/** One command; a new one (no id yet) gets one. */
function parseCommand(value: unknown, index: number): DeploymentCommand {
  const raw = asRecord(value);
  const where = `Command ${index + 1}`;
  const id =
    raw.id === undefined || raw.id === null || raw.id === ""
      ? randomBytes(6).toString("hex")
      : raw.id;
  if (typeof id !== "string" || !COMMAND_ID.test(id)) {
    throw new Error(`${where} has an invalid id`);
  }
  const label = parseText(
    raw.label ?? "",
    `${where}'s label`,
    MAX_COMMAND_LABEL_LENGTH,
  ).trim();
  const serviceName = parseText(
    raw.serviceName ?? "",
    `${where}'s service`,
    MAX_NAME_LENGTH,
  ).trim();
  const command = parseText(
    raw.command ?? "",
    `${where}'s command`,
    MAX_COMMAND_LENGTH,
  ).trim();
  if (!label) throw new Error(`${where} needs a label`);
  if (!serviceName) throw new Error(`${where} needs a service`);
  if (!command) throw new Error(`${where} needs a command`);
  if (/[\r\n\0]/.test(command)) {
    throw new Error(`${where}'s command must be on one line`);
  }
  return { id, label, serviceName, command };
}

/** Commands, each in a service of the compose file, with unique ids. */
function parseCommands(
  value: unknown,
  services: string[],
): DeploymentCommand[] {
  const commands = parseList(value, "commands", MAX_DEPLOYMENT_COMMANDS).map(
    parseCommand,
  );
  const ids = new Set<string>();
  for (const [index, command] of commands.entries()) {
    if (ids.has(command.id)) {
      throw new Error(`Command ${index + 1} has the same id as another`);
    }
    ids.add(command.id);
    if (!services.includes(command.serviceName)) {
      throw new Error(
        `Command "${command.label}" runs in service "${command.serviceName}", which is not in the compose file`,
      );
    }
  }
  return commands;
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
  const problem = checkErrorMessage(check.issues);
  if (problem) throw new Error(problem);
  return {
    type: raw.type as DeploymentType,
    projectId: raw.projectId,
    name: draft.name.trim(),
    composeFile: check.composeFile,
    variables: draft.variables,
    domains: draft.domains,
    commands: parseCommands(raw.commands, check.services),
  };
}

/**
 * A variant's own settings, shape only: `fitVariants` checks them against
 * the product once the product's own are known. Null deploys the product's.
 */
function parseVariantDeployment(
  value: unknown,
  where: string,
): VariantDeployment | null {
  if (value === undefined || value === null) return null;
  const raw = asRecord(value);
  const composeFile = parseText(
    raw.composeFile ?? "",
    `${where}'s compose file`,
    MAX_COMPOSE_LENGTH,
  );
  if (!composeFile.trim()) throw new Error(`${where}'s compose file is empty`);
  return {
    composeFile,
    variables: parseList(
      raw.variables,
      `${where}'s variables`,
      MAX_VARIABLES,
    ).map(parseVariable),
    domains: parseList(raw.domains, `${where}'s domains`, MAX_DOMAINS).map(
      parseDomain,
    ),
    commands: parseList(
      raw.commands,
      `${where}'s commands`,
      MAX_DEPLOYMENT_COMMANDS,
    ).map(parseCommand),
  };
}

/** One variant's shape; `fitVariants` checks it against the product. */
function parseVariant(value: unknown, index: number): ProductVariant {
  const raw = asRecord(value);
  const where = `Variant ${index + 1}`;
  const id =
    raw.id === undefined || raw.id === null || raw.id === ""
      ? randomBytes(6).toString("hex")
      : raw.id;
  if (typeof id !== "string" || !VARIANT_ID.test(id)) {
    throw new Error(`${where} has an invalid id`);
  }
  const name = parseText(
    raw.name ?? "",
    `${where}'s name`,
    MAX_NAME_LENGTH,
  ).trim();
  if (!name) throw new Error(`${where} needs a name`);
  const deployment = parseVariantDeployment(raw.deployment, where);
  const composeFile =
    deployment !== null ||
    raw.composeFile === undefined ||
    raw.composeFile === null ||
    raw.composeFile === ""
      ? null
      : parseText(
          raw.composeFile,
          `${where}'s compose file`,
          MAX_COMPOSE_LENGTH,
        );
  return {
    id,
    name,
    specs: parseText(raw.specs ?? "", `${where}'s specs`, MAX_SPECS_LENGTH),
    pricingText: parsePricingText(raw.pricingText ?? ""),
    description: parseDescription(raw.description ?? ""),
    priceIdr: parsePriceIdr(raw.priceIdr),
    durationDays: parseDays(raw.durationDays, `${where}'s durationDays`),
    deployment,
    composeFile,
  };
}

function parseVariants(value: unknown): ProductVariant[] {
  return parseList(value, "variants", MAX_PRODUCT_VARIANTS).map(parseVariant);
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
    variantName:
      kind === "subscription"
        ? parseText(
            raw.variantName ?? "",
            "variantName",
            MAX_NAME_LENGTH,
          ).trim()
        : "",
    variantSpecs:
      kind === "subscription"
        ? parseText(raw.variantSpecs ?? "", "variantSpecs", MAX_SPECS_LENGTH)
        : "",
    variants: kind === "subscription" ? parseVariants(raw.variants) : [],
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
  if (kind === "subscription") {
    if ("variantName" in raw) {
      patch.variantName = parseText(
        raw.variantName,
        "variantName",
        MAX_NAME_LENGTH,
      ).trim();
    }
    if ("variantSpecs" in raw) {
      patch.variantSpecs = parseText(
        raw.variantSpecs,
        "variantSpecs",
        MAX_SPECS_LENGTH,
      );
    }
    if ("variants" in raw) patch.variants = parseVariants(raw.variants);
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

  let variantId: string | null = null;
  if (
    raw.variantId !== undefined &&
    raw.variantId !== null &&
    raw.variantId !== ""
  ) {
    if (typeof raw.variantId !== "string" || !VARIANT_ID.test(raw.variantId)) {
      throw new Error("variantId is not a valid variant");
    }
    variantId = raw.variantId;
  }

  return { productId, end, variantId };
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
