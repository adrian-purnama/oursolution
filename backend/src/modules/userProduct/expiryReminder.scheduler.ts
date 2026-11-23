import { logger } from "../../logger/logger";
import { remindExpiring } from "./expiryReminder";

const SOURCE = "modules/userProduct/expiryReminder.scheduler.ts";
/** How often to look for subscriptions about to end. */
const SWEEP_INTERVAL_MS = 30 * 60_000;

/**
 * Every half hour, and once now: reminds owners whose subscription ends
 * within EXPIRY_REMINDER_DAYS. A sweep never overlaps the previous one.
 */
export function startExpiryReminderSweep(): void {
  let sweeping = false;
  const sweep = async () => {
    if (sweeping) return;
    sweeping = true;
    try {
      await remindExpiring();
    } catch (error) {
      logger.error(
        `Expiry reminder sweep failed: ${error instanceof Error ? error.message : String(error)}`,
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
