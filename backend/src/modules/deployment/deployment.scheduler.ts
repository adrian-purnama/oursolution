import { logger } from "../../logger/logger";
import { deploymentService } from "./deployment.service";

const SOURCE = "modules/deployment/deployment.scheduler.ts";
/** How often to look for services whose subscription has ended. */
const SWEEP_INTERVAL_MS = 5 * 60_000;

/**
 * Turns off services whose subscription has ended, now and every few
 * minutes. A sweep never overlaps the previous one.
 */
export function startLapsedSubscriptionSweep(): void {
  let sweeping = false;

  const sweep = async () => {
    if (sweeping) return;
    sweeping = true;
    try {
      await deploymentService.turnOffLapsed();
    } catch (error) {
      logger.error(
        `Sweep for ended subscriptions failed: ${error instanceof Error ? error.message : String(error)}`,
        SOURCE,
        "sweep",
      );
    } finally {
      sweeping = false;
    }
  };

  void sweep();
  setInterval(() => void sweep(), SWEEP_INTERVAL_MS).unref();
}
