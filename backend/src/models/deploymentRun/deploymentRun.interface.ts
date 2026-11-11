import { Types } from "mongoose";

/**
 * - deploy: first deploy, and turning back on after a turn off.
 * - redeploy: pushes current settings and rebuilds; data is kept.
 * - restart: stops and starts the containers.
 * - turnOff: stops the containers and removes the public routes.
 * - reset: stops, erases the customer's own folders, and deploys afresh.
 * - wipe: admin only, once the service is off and the subscription is over:
 *   erases the customer's own folders and deploys nothing.
 */
export const RUN_ACTIONS = [
  "deploy",
  "redeploy",
  "restart",
  "turnOff",
  "reset",
  "wipe",
] as const;
export type RunAction = (typeof RUN_ACTIONS)[number];

export const RUN_STATUSES = ["running", "succeeded", "failed"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const STEP_STATUSES = ["pending", "running", "done", "failed"] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

export interface RunStep {
  key: string;
  /** What the customer sees: deliberately vague. */
  label: string;
  /** What admins see: what the step really does. */
  internalLabel: string;
  status: StepStatus;
  /** Admin-only: why it failed. */
  error: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
}

/** One pass of a pipeline over a deployment, kept as history. */
export interface DeploymentRunInterface {
  deploymentId: Types.ObjectId;
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  action: RunAction;
  status: RunStatus;
  steps: RunStep[];
  /** Who started it; null when the system did (e.g. a lapsed subscription). */
  startedBy: Types.ObjectId | null;
  startedAt: Date;
  finishedAt: Date | null;
}
