import { Types } from "mongoose";
import type { DeploymentState } from "../deployment/deployment.interface";

/**
 * Who an admin email goes to:
 * - "all": every unblocked user;
 * - "users": the users the admin picked;
 * - "product": users of one product, either those who have it active or
 *   those whose deployment of it is in one of `states`.
 */
export const BROADCAST_AUDIENCE_TYPES = ["all", "users", "product"] as const;
export type BroadcastAudienceType = (typeof BROADCAST_AUDIENCE_TYPES)[number];

export const BROADCAST_PRODUCT_MATCHES = ["active", "deployment"] as const;
export type BroadcastProductMatch = (typeof BROADCAST_PRODUCT_MATCHES)[number];

export interface BroadcastAudience {
  type: BroadcastAudienceType;
  /** "users" only. */
  userIds: Types.ObjectId[];
  /** "product" only. */
  productId: Types.ObjectId | null;
  /** "product" only. */
  match: BroadcastProductMatch | null;
  /** "product" with match "deployment" only. */
  states: DeploymentState[];
}

export const BROADCAST_STATUSES = ["sending", "sent"] as const;
export type BroadcastStatus = (typeof BROADCAST_STATUSES)[number];

/** An email an admin sent to many users at once, kept as a log. */
export interface BroadcastInterface {
  subject: string;
  body: string;
  /** An internal path the email's button opens, or null for no button. */
  link: string | null;
  buttonLabel: string | null;
  /** Also stored as an in-app notification. */
  inApp: boolean;
  audience: BroadcastAudience;
  /** How the audience read when it was sent, e.g. "n8n · deployment running". */
  audienceLabel: string;
  status: BroadcastStatus;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdBy: Types.ObjectId;
  finishedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
