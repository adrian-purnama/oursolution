import type { DeploymentState } from "../models/deployment/deployment.interface";
import type {
  RunAction,
  RunStatus,
  StepStatus,
} from "../models/deploymentRun/deploymentRun.interface";
import type { VariableVisibility } from "../models/product/product.interface";
import type { ProductSummaryDto } from "./product.dto";

export interface RunStepOutDto {
  key: string;
  label: string;
  status: StepStatus;
  /** Admin view only. */
  internalLabel?: string;
  /** Admin view only. */
  error?: string | null;
}

export interface DeploymentRunOutDto {
  id: string;
  action: RunAction;
  status: RunStatus;
  startedAt: string;
  finishedAt: string | null;
  /** True when the system started it, e.g. after a subscription ended. */
  automatic: boolean;
  steps: RunStepOutDto[];
}

export interface DeploymentVariableOutDto {
  key: string;
  value: string;
  /** The customer may change it; it applies at the next deploy. */
  editable: boolean;
  /** Admin view only: hidden ones are only in the admin view. */
  visibility?: VariableVisibility;
}

export type ServiceCheckState = "up" | "down" | "pending" | "maintenance";

export interface ServiceBeatOutDto {
  state: ServiceCheckState;
  at: string;
}

/** How one address did over the last 24 hours, from Uptime Kuma. */
export interface ServiceStatusOutDto {
  host: string;
  state: ServiceCheckState;
  /** Share of checks that were up, 0 to 1. Null before the first check. */
  uptime: number | null;
  responseMs: number | null;
  checkedAt: string | null;
  /** The latest checks, oldest first. */
  beats: ServiceBeatOutDto[];
}

export interface DeploymentOutDto {
  product: ProductSummaryDto;
  /** The subscription is running, so the service may run. */
  entitled: boolean;
  state: DeploymentState;
  /** When the running subscription ends; null for no end or not running. */
  subscriptionEndsAt: string | null;
  /** When the service last came up, while it runs; else null. */
  runningSince: string | null;
  /** Public addresses, e.g. "n8n-jo.example.com". */
  hosts: string[];
  variables: DeploymentVariableOutDto[];
  /** Per address, while the service runs and is monitored; else empty. */
  status: ServiceStatusOutDto[];
  /** What can be started now. */
  actions: RunAction[];
  /** Latest first. */
  runs: DeploymentRunOutDto[];
  /** Admin view only. */
  internal?: {
    name: string | null;
    username: string;
    composeId: string | null;
    appName: string | null;
    routedHosts: string[];
    monitors: { host: string; monitorId: number }[];
    /** Host folders a reset empties: this customer's and nobody else's. */
    resetFolders: string[];
    /** Mounted host paths a reset leaves alone, and why. */
    resetSkipped: { path: string; reason: string }[];
    /** Whether "Delete data" may run now, and if not, why. */
    wipe: { allowed: boolean; reason: string | null };
  };
}

/** One line of the admin overview of every deployment. */
export interface AdminDeploymentRowOutDto {
  user: { id: string; email: string };
  deployment: DeploymentOutDto;
}

/** Body of a values update: editable variable keys to values. */
export interface UpdateDeploymentValuesInDto {
  values: Record<string, string>;
}

export interface DeploymentActionInDto {
  action: RunAction;
}
