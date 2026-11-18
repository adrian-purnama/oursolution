import type { DeploymentState } from "../models/deployment/deployment.interface";
import type {
  RunAction,
  RunStatus,
  StepStatus,
} from "../models/deploymentRun/deploymentRun.interface";
import type {
  ProductNotice,
  VariableVisibility,
} from "../models/product/product.interface";
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
  /** Command runs only: the label of the command that ran. */
  commandLabel: string | null;
  steps: RunStepOutDto[];
}

/** A command the customer can run; what it really runs stays hidden. */
export interface DeploymentCommandOutDto {
  id: string;
  label: string;
}

export interface DeploymentVariableOutDto {
  key: string;
  value: string;
  /** It may be changed now; it applies at the next deploy. */
  editable: boolean;
  /** The customer fills it once before the first deploy; then it is fixed. */
  setOnce: boolean;
  /** Set-once only: it has a value. */
  filled: boolean;
  /**
   * Set once, then hidden: the customer is never shown its value again, so
   * `value` is empty for them once it is filled.
   */
  secret: boolean;
  /** Set-once only: the product's example for the empty field. */
  placeholder: string | null;
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
  /** The product's rules and disclaimers, for the customer to read. */
  notices: ProductNotice[];
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
  /** Set-once variables still to fill; deploying waits for them. */
  missingValues: string[];
  /** Per address, while the service runs and is monitored; else empty. */
  status: ServiceStatusOutDto[];
  /** What can be started now. */
  actions: RunAction[];
  /** The product's commands, by label. */
  commands: DeploymentCommandOutDto[];
  /** Why the commands cannot run now, or null when they can. */
  commandsBlocked: string | null;
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
    /** Host folders erasing empties: this customer's and nobody else's. */
    resetFolders: string[];
    /** Mounted host paths erasing leaves alone, and why. */
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

/** One host of a deployment, as a sync found it. */
export interface DeploymentSyncDomainOutDto {
  host: string;
  /** Dokploy has it as a domain of the compose; null: not checked. */
  registered: boolean | null;
  /** Routed by the Cloudflare tunnel with its DNS record; null: not checked. */
  on: boolean | null;
  /** What is wrong with it for the service's state, or null. */
  issue: string | null;
}

/** What a sync did with one deployment. */
export interface DeploymentSyncItemOutDto {
  user: { id: string; email: string };
  product: { id: string; name: string };
  /** "skipped": a run was in progress, so it was left alone. */
  outcome: "unchanged" | "changed" | "skipped" | "failed";
  from: DeploymentState;
  to: DeploymentState;
  /** What Dokploy shows; null when never deployed or not checked. */
  containers: "running" | "stopped" | "degraded" | "missing" | null;
  /** Why it failed or was skipped, or what else changed. */
  message: string | null;
  domains: DeploymentSyncDomainOutDto[];
}

/** The result of syncing every deployment with Dokploy and Cloudflare. */
export interface DeploymentSyncOutDto {
  checked: number;
  changed: number;
  skipped: number;
  failed: number;
  /** Hosts with an issue. */
  domainIssues: number;
  /** Why hosts' on/off could not be checked in Cloudflare, or null. */
  cloudflareError: string | null;
  items: DeploymentSyncItemOutDto[];
}

/** Body of a values update: editable variable keys to values. */
export interface UpdateDeploymentValuesInDto {
  values: Record<string, string>;
}

export interface DeploymentActionInDto {
  action: RunAction;
}
