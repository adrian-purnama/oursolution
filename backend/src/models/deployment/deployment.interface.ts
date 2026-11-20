import { Types } from "mongoose";

/**
 * Where a customer's deployment of a product stands. "deploying",
 * "stopping", "restarting", "erasing" and "runningCommand" mean a run is
 * in progress.
 */
export const DEPLOYMENT_STATES = [
  "notDeployed",
  "deploying",
  "running",
  "stopping",
  "stopped",
  "restarting",
  "erasing",
  "runningCommand",
  "failed",
] as const;
export type DeploymentState = (typeof DEPLOYMENT_STATES)[number];

/** A value the customer typed for one of the product's editable variables. */
export interface DeploymentValue {
  key: string;
  value: string;
}

/** Where the compose lives in Dokploy, once created. */
export interface DokployLink {
  projectId: string;
  environmentId: string;
  composeId: string;
  appName: string;
}

/** The Uptime Kuma monitor that checks one of the deployment's hosts. */
export interface DeploymentMonitor {
  host: string;
  monitorId: number;
}

/** One customer's deployment of one subscription product. */
export interface DeploymentInterface {
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  state: DeploymentState;
  values: DeploymentValue[];
  /** The resolved name in Dokploy, fixed at the first deploy. */
  name: string | null;
  /** Hosts this deployment owns in Cloudflare (route and DNS record). */
  routedHosts: string[];
  dokploy: DokployLink | null;
  /**
   * The product variant whose compose file was last pushed to Dokploy.
   * Null before the first push, and for deployments pushed before variants
   * existed, which run the base variant.
   */
  deployedVariantId: string | null;
  /** Paused while the service is off, so being off is not downtime. */
  monitors: DeploymentMonitor[];
  createdAt?: Date;
  updatedAt?: Date;
}
