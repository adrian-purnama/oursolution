import type { DeploymentState } from "../../models/deployment/deployment.interface";
import type { RunAction } from "../../models/deploymentRun/deploymentRun.interface";

/** States in which a run is in progress, so nothing else may start. */
export const BUSY_STATES: readonly DeploymentState[] = [
  "deploying",
  "stopping",
  "restarting",
  "erasing",
];

/** The state a deployment is in while an action runs. */
export const STATE_DURING: Record<RunAction, DeploymentState> = {
  deploy: "deploying",
  redeploy: "deploying",
  restart: "restarting",
  turnOff: "stopping",
  reset: "deploying",
  wipe: "erasing",
};

/** The state after an action succeeds. */
export const STATE_AFTER: Record<RunAction, DeploymentState> = {
  deploy: "running",
  redeploy: "running",
  restart: "running",
  turnOff: "stopped",
  reset: "running",
  wipe: "stopped",
};

/**
 * What may start from a state. Without a running subscription only turning
 * off is left, and only when something may still be running.
 */
export function allowedActions(
  state: DeploymentState,
  entitled: boolean,
): RunAction[] {
  const byState: Record<DeploymentState, RunAction[]> = {
    notDeployed: ["deploy"],
    running: ["restart", "redeploy", "turnOff", "reset"],
    stopped: ["deploy", "reset"],
    failed: ["deploy", "turnOff", "reset"],
    deploying: [],
    stopping: [],
    restarting: [],
    erasing: [],
  };
  const actions = byState[state];
  return entitled ? actions : actions.filter((action) => action === "turnOff");
}

/**
 * Why an admin may not delete a customer's data now, or null when they
 * may. Never while a subscription could still need it, and never while
 * anything may be running or writing to the folders.
 */
export function wipeBlocker(
  state: DeploymentState,
  entitled: boolean,
  folderCount: number,
): string | null {
  if (entitled) {
    return "The subscription is still active. Data can be deleted once it has ended";
  }
  if (state === "notDeployed") {
    return "It was never deployed, so there is no data";
  }
  if (state !== "stopped") {
    return "Turn the service off first";
  }
  if (folderCount === 0) {
    return "The compose file mounts no host folder that is this customer's only and inside DEPLOY_DATA_ROOTS";
  }
  return null;
}

/** True when the service may be running and should be turned off. */
export function mayBeRunning(state: DeploymentState): boolean {
  return state === "running" || state === "failed";
}

/**
 * Whether the sweep should turn a deployment off now. Not after its own
 * automatic turn-off failed: admins were emailed, and retrying every few
 * minutes would only repeat the email. An admin takes it from there.
 */
export function shouldAutoTurnOff(
  state: DeploymentState,
  entitled: boolean,
  latestRun: { action: RunAction; automatic: boolean; failed: boolean } | null,
): boolean {
  if (entitled || !mayBeRunning(state)) return false;
  return !(
    latestRun &&
    latestRun.action === "turnOff" &&
    latestRun.automatic &&
    latestRun.failed
  );
}

const HOUR_MS = 60 * 60_000;

/**
 * How often a customer may start things on one deployment. Each start
 * makes Dokploy and Cloudflare work, so someone clicking on and off all
 * day would wear on every customer. Turning off is never limited: stopping
 * a service must always be possible. Admins are not limited.
 */
export const START_LIMITS: readonly {
  actions: readonly RunAction[];
  max: number;
  windowMs: number;
}[] = [
  {
    actions: ["deploy", "redeploy", "restart", "reset"],
    max: 6,
    windowMs: HOUR_MS,
  },
  {
    actions: ["deploy", "redeploy", "restart", "reset"],
    max: 20,
    windowMs: 24 * HOUR_MS,
  },
  { actions: ["reset"], max: 2, windowMs: 24 * HOUR_MS },
];

/** The longest window above: how far back starts need to be looked up. */
export const START_HISTORY_MS = Math.max(
  ...START_LIMITS.map((limit) => limit.windowMs),
);

/**
 * When `action` may start again given the customer's earlier starts, or
 * null when it may start now.
 */
export function nextAllowedStart(
  action: RunAction,
  starts: readonly { action: RunAction; startedAt: Date }[],
  now: Date,
): Date | null {
  let next: Date | null = null;
  for (const limit of START_LIMITS) {
    if (!limit.actions.includes(action)) continue;
    const counted = starts
      .filter(
        (start) =>
          limit.actions.includes(start.action) &&
          start.startedAt.getTime() > now.getTime() - limit.windowMs,
      )
      .map((start) => start.startedAt.getTime())
      .sort((a, b) => a - b);
    if (counted.length < limit.max) continue;
    // Free again once enough of the oldest have left the window.
    const free = new Date(counted[counted.length - limit.max] + limit.windowMs);
    if (!next || free > next) next = free;
  }
  return next;
}

export interface StepDefinition {
  key: string;
  label: string;
  internalLabel: string;
}

/** Each action's steps, in order. Customers see `label` only. */
export const PIPELINES: Record<RunAction, StepDefinition[]> = {
  deploy: [
    {
      key: "check",
      label: "Preparing",
      internalLabel:
        "Check subscription, Dokploy and Cloudflare, and that the name and hosts are free",
    },
    {
      key: "dokploy",
      label: "Deploying",
      internalLabel:
        "Create or update the compose, env and domains in Dokploy, deploy, and wait for it",
    },
    {
      key: "route",
      label: "Connecting your address",
      internalLabel: "Route the hosts through the Cloudflare tunnel to Traefik",
    },
  ],
  redeploy: [
    {
      key: "check",
      label: "Preparing",
      internalLabel:
        "Check subscription, Dokploy and Cloudflare, and that the name and hosts are free",
    },
    {
      key: "dokploy",
      label: "Redeploying",
      internalLabel:
        "Push the current compose, env and domains to Dokploy, deploy, and wait for it",
    },
    {
      key: "route",
      label: "Connecting your address",
      internalLabel: "Route the hosts through the Cloudflare tunnel to Traefik",
    },
  ],
  restart: [
    {
      key: "restart",
      label: "Restarting",
      internalLabel: "Stop and start the compose in Dokploy",
    },
  ],
  reset: [
    {
      key: "check",
      label: "Preparing",
      internalLabel:
        "Check subscription, Dokploy and Cloudflare, that the name and hosts are free, and that the folders to empty are this customer's only",
    },
    {
      key: "stop",
      label: "Stopping",
      internalLabel: "Stop the compose in Dokploy",
    },
    {
      key: "wipe",
      label: "Erasing your data",
      internalLabel:
        "Empty the customer's own host folders with a one-off container in Dokploy",
    },
    {
      key: "dokploy",
      label: "Deploying",
      internalLabel:
        "Create or update the compose, env and domains in Dokploy, deploy, and wait for it",
    },
    {
      key: "route",
      label: "Connecting your address",
      internalLabel: "Route the hosts through the Cloudflare tunnel to Traefik",
    },
  ],
  wipe: [
    {
      key: "wipeCheck",
      label: "Preparing",
      internalLabel:
        "Check the service is off, the subscription is over, and that the folders to empty are this customer's only",
    },
    {
      key: "stop",
      label: "Stopping",
      internalLabel:
        "Make sure the compose is stopped in Dokploy, so nothing writes while erasing",
    },
    {
      key: "wipe",
      label: "Erasing the data",
      internalLabel:
        "Empty the customer's own host folders with a one-off container in Dokploy",
    },
  ],
  turnOff: [
    {
      key: "stop",
      label: "Stopping",
      internalLabel: "Stop the compose in Dokploy (data is kept)",
    },
    {
      key: "unroute",
      label: "Disconnecting your address",
      internalLabel:
        "Remove the hosts' Cloudflare tunnel routes and DNS records",
    },
  ],
};

export const ACTION_LABELS: Record<RunAction, string> = {
  reset: "Reset",
  deploy: "Deploy",
  redeploy: "Redeploy",
  restart: "Restart",
  turnOff: "Turn off",
  wipe: "Delete data",
};
