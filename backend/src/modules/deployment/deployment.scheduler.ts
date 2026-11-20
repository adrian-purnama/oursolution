import { logger } from "../../logger/logger";
import { deploymentService } from "./deployment.service";

const SOURCE = "modules/deployment/deployment.scheduler.ts";
/** How often to look for ended subscriptions and changed variants. */
const SWEEP_INTERVAL_MS = 5 * 60_000;

/** Runs one sweep pass, logging instead of throwing. */
async function pass(label: string, run: () => Promise<number>): Promise<void> {
  try {
    await run();
  } catch (error) {
    logger.error(
      `${label} failed: ${error instanceof Error ? error.message : String(error)}`,
      SOURCE,
      "sweep",
    );
  }
}

/**
 * Every few minutes, and once now: turns off services whose subscription
 * has ended, then redeploys running ones whose variant changed, when the
 * customer chose that. A sweep never overlaps the previous one.
 */
export function startLapsedSubscriptionSweep(): void {
  let sweeping = false;

  const sweep = async () => {
    if (sweeping) return;
    sweeping = true;
    try {
      // Each pass on its own, so one failing does not hold up the other.
      await pass("Sweep for ended subscriptions", () =>
        deploymentService.turnOffLapsed(),
      );
      await pass("Sweep for changed variants", () =>
        deploymentService.applyPendingVariants(),
      );
    } finally {
      sweeping = false;
    }
  };

  void sweep();
  setInterval(() => void sweep(), SWEEP_INTERVAL_MS).unref();
}
