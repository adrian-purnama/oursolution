import { Types } from "mongoose";

export const CHANGE_TARGETS = ["env", "compose"] as const;
export type ChangeTarget = (typeof CHANGE_TARGETS)[number];

/**
 * One change an admin made to a deployment's overrides. `before` null: there
 * was no override (the product's applied); `after` null: it was reset.
 */
export interface DeploymentChangeInterface {
  deploymentId: Types.ObjectId;
  /** Null when the admin's account is gone. */
  byUserId: Types.ObjectId | null;
  /** Kept as it was then, so the log reads the same later. */
  byEmail: string;
  target: ChangeTarget;
  /** The variable, for an env change. */
  key: string | null;
  before: string | null;
  after: string | null;
  at: Date;
}
