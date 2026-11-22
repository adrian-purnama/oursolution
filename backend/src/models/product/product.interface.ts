import { Types } from "mongoose";

/**
 * - "subscription": active for a period (hosting). Lives on the user's plan
 *   timeline; each checkout adds `durationDays`.
 * - "oneTime": bought once and kept for good (e.g. an n8n workflow). Buying it
 *   creates a Purchase; it never expires.
 */
export const PRODUCT_KINDS = ["subscription", "oneTime"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

/** How a subscription's service is deployed. Only Docker Compose for now. */
export const DEPLOYMENT_TYPES = ["dockerCompose"] as const;
export type DeploymentType = (typeof DEPLOYMENT_TYPES)[number];

/**
 * Who sees a deployment variable:
 * - "editable": the customer sees it and can change it; the value is a default.
 * - "readOnly": the customer sees it but only an admin sets it.
 * - "hidden": the customer never sees it.
 * - "setOnce": the customer must fill it before the service can be turned
 *   on, and cannot change it afterwards; they keep seeing it. The admin's
 *   value is only an example shown in the empty field.
 * - "setOnceHidden": like "setOnce", but once filled its value is never
 *   shown to the customer again, e.g. a first admin password.
 */
export const VARIABLE_VISIBILITIES = [
  "editable",
  "readOnly",
  "hidden",
  "setOnce",
  "setOnceHidden",
] as const;
export type VariableVisibility = (typeof VARIABLE_VISIBILITIES)[number];

/** The customer fills it once, before the first deploy. */
export function isSetOnce(visibility: VariableVisibility): boolean {
  return visibility === "setOnce" || visibility === "setOnceHidden";
}

/** The customer decides its value, so it can be anything at all. */
export function isCustomerSet(visibility: VariableVisibility): boolean {
  return visibility === "editable" || isSetOnce(visibility);
}

/** One `KEY=value` of a deployment's environment. */
export interface DeploymentVariable {
  key: string;
  /** May use the built-in variables, e.g. `${USERNAME}`. */
  value: string;
  visibility: VariableVisibility;
}

/** A public address routed to one service of the compose file. */
export interface DeploymentDomain {
  /** A service in the compose file. */
  serviceName: string;
  /**
   * Per customer and one part only, e.g. `n8n-${USERNAME}`. The host is it
   * plus "." and DEPLOY_DOMAIN.
   */
  subdomain: string;
  /** The port the service listens on inside its container. */
  port: number;
}

/** How many commands one product may offer. */
export const MAX_DEPLOYMENT_COMMANDS = 20;

/**
 * A command a customer may run inside one of their service's containers,
 * e.g. n8n's `n8n user-management:reset`. Customers see only `label`.
 */
export interface DeploymentCommand {
  /** Stable across edits, so runs and buttons keep pointing at it. */
  id: string;
  /** What the customer sees on the button, e.g. "Reset owner password". */
  label: string;
  /** The compose service whose running container it runs in. */
  serviceName: string;
  /** Run with `sh -c` inside that container. Admin-only. */
  command: string;
}

export interface ProductDeployment {
  type: DeploymentType;
  /** The Dokploy project every deployment of this product goes into. */
  projectId: string;
  /** The compose's name in Dokploy, per customer, e.g. `n8n-${USERNAME}`. */
  name: string;
  /**
   * Checked and re-indented on save (`utils/deployment.ts`). Its
   * `${VARIABLES}` come from `variables` and the built-ins.
   */
  composeFile: string;
  variables: DeploymentVariable[];
  domains: DeploymentDomain[];
  /** Commands customers can run on their running service. */
  commands: DeploymentCommand[];
}

/**
 * How a notice looks: "info" for good-to-know, "warning" for something the
 * customer can lose, such as data or a password that cannot be recovered.
 */
export const NOTICE_TONES = ["info", "warning"] as const;
export type NoticeTone = (typeof NOTICE_TONES)[number];

/** One rule or disclaimer shown to buyers and on the customer's service. */
export interface ProductNotice {
  tone: NoticeTone;
  /** Markdown, so it can link to a contact form. */
  text: string;
}

/** How many images one product may have. */
export const MAX_PRODUCT_IMAGES = 10;

/**
 * The id of a subscription's base variant: the product's own price,
 * duration and compose file. Records without a variant id are on it.
 */
export const BASE_VARIANT_ID = "default";

/** How many variants a subscription may have besides its base one. */
export const MAX_PRODUCT_VARIANTS = 10;

/**
 * A variant's own deployment settings. The Dokploy project and the name in
 * Dokploy stay the product's, so a customer who switches variant keeps the
 * same compose and their data.
 */
export interface VariantDeployment {
  /**
   * Checked and re-indented on save. It must mount the same sources as the
   * product's, so switching keeps the customer's data.
   */
  composeFile: string;
  variables: DeploymentVariable[];
  domains: DeploymentDomain[];
  commands: DeploymentCommand[];
}

/**
 * Another way to buy the same subscription, e.g. more CPU and memory. It
 * has its own price and duration, and may have its own deployment settings;
 * it shares the product's name, Dokploy project and data, so a customer can
 * switch between variants and keep their service.
 */
export interface ProductVariant {
  /** Stable across edits; periods and deployments point at it. */
  id: string;
  /** What customers pick, e.g. "4 cores / 4 GB". */
  name: string;
  /** Public, short: what this variant gives. */
  specs: string;
  /**
   * Free text shown as its price once chosen, e.g. "Rp 149.000 / month";
   * empty shows the price itself.
   */
  pricingText: string;
  /** Markdown shown once chosen; empty shows the product's description. */
  description: string;
  /** Amount charged per checkout, in whole rupiah. */
  priceIdr: number;
  /** How long one checkout keeps it active. */
  durationDays: number;
  /** Its own deployment settings, or null to deploy the product's. */
  deployment: VariantDeployment | null;
  /**
   * Legacy: saved before variants had their own settings, a compose file
   * used with the product's variables, domains and commands. Read only when
   * `deployment` is null; new saves leave it null.
   */
  composeFile: string | null;
}

/** Something a user can have: a subscription or a one-time purchase. */
export interface ProductInterface {
  name: string;
  /** Fixed at creation: records already made depend on it. */
  kind: ProductKind;
  /** Hex color, e.g. "#1a5c4a". */
  color: string;
  /** Free text shown on the pricing page, e.g. "Rp 99.000 / month". */
  pricingText: string;
  /** Public, multi-line text shown on the card and the product page. */
  description: string;
  /** Public notices, in order: on the product page and the service page. */
  notices: ProductNotice[];
  /** Amount charged per checkout, in whole rupiah. */
  priceIdr: number;
  /** Subscription only: how long one checkout keeps it active. */
  durationDays: number | null;
  /** Subscription only: what to deploy for a subscriber. Admin-only. */
  deployment: ProductDeployment | null;
  /** Subscription only: the base variant's name, e.g. "2 cores / 2 GB". */
  variantName: string;
  /** Subscription only: the base variant's specs. */
  variantSpecs: string;
  /** Subscription only: variants besides the base one, in display order. */
  variants: ProductVariant[];
  /** One-time only: where buyers get what they bought. Never shown publicly. */
  accessUrl: string | null;
  /** Listed on the public pricing page, and so open to checkout. */
  showOnPricingPage: boolean;
  /**
   * Public images in the "public" GridFS bucket, served from /media/:id, in
   * display order: the first is the cover on cards and badges.
   */
  images: Types.ObjectId[];
  /**
   * Set when soft deleted: hidden from the pricing page, checkout and admin
   * assignment, but kept so owners keep access and it can be restored.
   */
  deletedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
