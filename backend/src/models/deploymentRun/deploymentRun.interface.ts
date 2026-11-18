import { Types } from "mongoose";

/**
 * - deploy: first deploy, and turning back on after a turn off.
 * - redeploy: pushes current settings and rebuilds; data is kept.
 * - restart: stops and starts the containers.
 * - turnOff: stops the containers and removes the public routes.
 * - erase: the customer, while the service is off: makes sure it is
 *   stopped, erases their own folders, and removes the service from
 *   Dokploy, Cloudflare and Uptime Kuma. It is as if never deployed.
 * - wipe: admin only, once the service is off and the subscription is over:
 *   erases the customer's own folders and removes the service, like erase.
 * - command: runs one of the product's commands inside a running container.
 */
export const RUN_ACTIONS = [
  "deploy",
  "redeploy",
  "restart",
  "turnOff",
  "erase",
  "wipe",
  "command",
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
  /** Command runs only: which command, as it was when it ran. */
  command: { id: string; label: string } | null;
  /** Who started it; null when the system did (e.g. a lapsed subscription). */
  startedBy: Types.ObjectId | null;
  startedAt: Date;
  finishedAt: Date | null;
}
