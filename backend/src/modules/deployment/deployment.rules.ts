import type { DeploymentState } from "../../models/deployment/deployment.interface";
import type {
  BulkAction,
  RunAction,
} from "../../models/deploymentRun/deploymentRun.interface";
import type { VariantApplyMode } from "../../models/userProductPeriod/userProductPeriod.interface";
import { variantIdOf } from "../product/product.variants";

/** States in which a run is in progress, so nothing else may start. */
export const BUSY_STATES: readonly DeploymentState[] = [
  "deploying",
  "stopping",
  "restarting",
  "erasing",
  "runningCommand",
];

/** The state a deployment is in while an action runs. */
export const STATE_DURING: Record<RunAction, DeploymentState> = {
  deploy: "deploying",
  redeploy: "deploying",
  restart: "restarting",
  turnOff: "stopping",
  erase: "erasing",
  wipe: "erasing",
  command: "runningCommand",
};

/** The state after an action succeeds. */
export const STATE_AFTER: Record<RunAction, DeploymentState> = {
  deploy: "running",
  redeploy: "running",
  restart: "running",
  turnOff: "stopped",
  // Nothing is left in Dokploy: the next turn-on starts from scratch.
  erase: "notDeployed",
  wipe: "notDeployed",
  command: "running",
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
    running: ["restart", "redeploy", "turnOff"],
    // Erasing needs the service off, so nothing writes meanwhile.
    stopped: ["deploy", "erase"],
    failed: ["deploy", "turnOff"],
    deploying: [],
    stopping: [],
    restarting: [],
    erasing: [],
    runningCommand: [],
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

/** How many deployments one bulk action may take. */
export const MAX_BULK_TARGETS = 100;

/**
 * What a bulk action does to one deployment: the run to start, or why it
 * is left alone. Never more than the one action asked for: erasing does
 * not turn a running service off first, and turning on never deploys a
 * service whose subscription ended. The run's own checks still apply.
 */
export function bulkPlan(
  action: BulkAction,
  state: DeploymentState,
  entitled: boolean,
  /** Update only: whether it runs what a redeploy would send now. */
  update: { status: "current" | "available" | "unknown" } | null = null,
): { run: RunAction } | { skip: string } {
  if (BUSY_STATES.includes(state)) {
    return { skip: "Something is already in progress" };
  }
  switch (action) {
    case "turnOn":
      if (state === "running") return { skip: "Already on" };
      if (!entitled) return { skip: "The subscription is not active" };
      return { run: "deploy" };
    case "turnOff":
      if (state === "stopped" || state === "notDeployed") {
        return { skip: "Already off" };
      }
      return { run: "turnOff" };
    case "erase":
      if (state === "notDeployed") return { skip: "Nothing to erase" };
      if (state !== "stopped") return { skip: "Turn it off first" };
      // The customer's erase while subscribed; an admin's wipe after.
      return { run: entitled ? "erase" : "wipe" };
    case "update":
      // A service that is off gets the new version when it is turned on.
      if (!mayBeRunning(state)) return { skip: "Off: updates when turned on" };
      if (!entitled) return { skip: "The subscription is not active" };
      if (update?.status === "current") return { skip: "Already up to date" };
      // "unknown" is updated too: nothing says it runs the latest.
      return { run: "redeploy" };
  }
}

/** True when the service may be running and should be turned off. */
export function mayBeRunning(state: DeploymentState): boolean {
  return state === "running" || state === "failed";
}

/**
 * Whether the service runs another variant than the subscription is on
 * now, so a redeploy is needed to apply it. Not while it is off or never
 * pushed: turning it on deploys the current variant anyway. A deployment
 * pushed before variants existed runs the base variant.
 */
export function variantPending(
  state: DeploymentState,
  pushed: boolean,
  deployedVariantId: string | null,
  currentVariantId: string | null,
): boolean {
  if (!pushed || currentVariantId === null || !mayBeRunning(state)) {
    return false;
  }
  return variantIdOf(deployedVariantId) !== currentVariantId;
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

/**
 * Whether the sweep should redeploy a service onto the variant its
 * subscription is on now: only when the customer chose "auto", and not
 * after its own automatic redeploy failed (admins were emailed; retrying
 * every few minutes would only repeat that). "manual" waits for the
 * customer, or for the next time the service is turned on.
 */
export function shouldAutoApplyVariant(
  pending: boolean,
  applyVariant: VariantApplyMode | null,
  latestRun: { action: RunAction; automatic: boolean; failed: boolean } | null,
): boolean {
  if (!pending || applyVariant !== "auto") return false;
  return !(
    latestRun &&
    latestRun.action === "redeploy" &&
    latestRun.automatic &&
    latestRun.failed
  );
}

/** What Dokploy shows of a deployment's compose; "missing": it is gone. */
export type ActualContainers = "running" | "stopped" | "degraded" | "missing";

/**
 * The state a sync stores once Dokploy has shown what really runs. Running
 * containers win over what we had; a service we thought was up and is not
 * becomes off. "failed" and "stopped" stay when nothing runs: a failed run
 * still needs an admin, and turning off is what cleans up its address.
 */
export function syncedState(
  stored: DeploymentState,
  actual: ActualContainers,
): DeploymentState {
  if (BUSY_STATES.includes(stored) || stored === "notDeployed") return stored;
  if (actual === "running") return "running";
  if (actual === "degraded") return "failed";
  return stored === "running" ? "stopped" : stored;
}

/** Where one host stands; null means it could not be checked. */
export interface DomainCheck {
  /** Dokploy has it as a domain of the compose. */
  registered: boolean | null;
  /** The Cloudflare tunnel routes it and its DNS record points there. */
  on: boolean | null;
}

/** What is wrong with a host given the service's state, or null. */
export function domainIssue(
  state: DeploymentState,
  check: DomainCheck,
): string | null {
  if (state === "running") {
    if (check.registered === false) return "Not registered in Dokploy";
    if (check.on === false) return "Off in Cloudflare while the service runs";
    return null;
  }
  if (BUSY_STATES.includes(state) || state === "failed") return null;
  return check.on ? "On in Cloudflare while the service is off" : null;
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
    actions: ["deploy", "redeploy", "restart", "erase"],
    max: 6,
    windowMs: HOUR_MS,
  },
  {
    actions: ["deploy", "redeploy", "restart", "erase"],
    max: 20,
    windowMs: 24 * HOUR_MS,
  },
  { actions: ["erase"], max: 2, windowMs: 24 * HOUR_MS },
  // Commands start a one-off job in Dokploy each time.
  { actions: ["command"], max: 5, windowMs: HOUR_MS },
  { actions: ["command"], max: 20, windowMs: 24 * HOUR_MS },
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
    {
      key: "ready",
      label: "Starting up",
      internalLabel:
        "Wait until every host answers over HTTPS (up to 5 minutes; a slow start does not fail the run)",
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
    {
      key: "ready",
      label: "Starting up",
      internalLabel:
        "Wait until every host answers over HTTPS (up to 5 minutes; a slow start does not fail the run)",
    },
  ],
  restart: [
    {
      key: "restart",
      label: "Restarting",
      internalLabel: "Stop and start the compose in Dokploy",
    },
    {
      key: "ready",
      label: "Starting up",
      internalLabel:
        "Wait until every host answers over HTTPS (up to 5 minutes; a slow start does not fail the run)",
    },
  ],
  erase: [
    {
      key: "wipeCheck",
      label: "Preparing",
      internalLabel:
        "Check the subscription, that the service is off, and that the folders to empty are this customer's only",
    },
    {
      key: "stop",
      label: "Stopping",
      internalLabel:
        "Make sure the compose is stopped in Dokploy, so nothing writes while erasing",
    },
    {
      key: "wipe",
      label: "Erasing your data",
      internalLabel:
        "Empty the customer's own host folders with a one-off container in Dokploy",
    },
    {
      key: "remove",
      label: "Removing your service",
      internalLabel:
        "Remove the Cloudflare routes, the compose with its containers and volumes in Dokploy, and the Uptime Kuma monitors. Set-once values are cleared",
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
    {
      key: "remove",
      label: "Removing the service",
      internalLabel:
        "Remove the Cloudflare routes, the compose with its containers and volumes in Dokploy, and the Uptime Kuma monitors. Set-once values are cleared",
    },
  ],
  command: [
    {
      key: "command",
      // Replaced by the command's own label when the run is made.
      label: "Running",
      internalLabel:
        "Run the command in the service's running container with a one-off job in Dokploy",
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
  erase: "Erase data",
  deploy: "Deploy",
  redeploy: "Redeploy",
  restart: "Restart",
  turnOff: "Turn off",
  wipe: "Delete data",
  command: "Run command",
};

/**
 * Why a customer's command cannot run now, or null when it can. Commands
 * run inside the containers, so only while the service is up.
 */
export function commandBlocker(
  state: DeploymentState,
  entitled: boolean,
): string | null {
  if (!entitled) return "The subscription is not active";
  if (BUSY_STATES.includes(state)) {
    return "Something is already in progress. Wait for it to finish";
  }
  if (state !== "running") return "Turn the service on first";
  return null;
}
