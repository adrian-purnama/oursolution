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
 */
export const VARIABLE_VISIBILITIES = [
  "editable",
  "readOnly",
  "hidden",
] as const;
export type VariableVisibility = (typeof VARIABLE_VISIBILITIES)[number];

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
  /** Amount charged per checkout, in whole rupiah. */
  priceIdr: number;
  /** Subscription only: how long one checkout keeps it active. */
  durationDays: number | null;
  /** Subscription only: what to deploy for a subscriber. Admin-only. */
  deployment: ProductDeployment | null;
  /** One-time only: where buyers get what they bought. Never shown publicly. */
  accessUrl: string | null;
  /** Listed on the public pricing page, and so open to checkout. */
  showOnPricingPage: boolean;
  /** Public image in the "public" GridFS bucket, served from /media/:id. */
  image: Types.ObjectId | null;
  /**
   * Set when soft deleted: hidden from the pricing page, checkout and admin
   * assignment, but kept so owners keep access and it can be restored.
   */
  deletedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
