import { env } from "../../environment/env";
import { logger } from "../../logger/logger";
import { ProductModel } from "../../models/product/product.model";
import { UserProductPeriodModel } from "../../models/userProductPeriod/userProductPeriod.model";
import { mailer } from "../mail/mail.service";
import { absoluteLink, notificationService } from "../notification/notification.service";
import { mongoBillingProfiles } from "../payment/payment.service";

const SOURCE = "modules/userProduct/expiryReminder.ts";
const DAY_MS = 24 * 60 * 60 * 1000;
/** A next period starting this close to the end continues the subscription. */
const CONTIGUOUS_MS = 60_000;
/** Most reminders sent in one sweep; the rest wait for the next. */
const BATCH = 200;

/** Whole days left, rounded up: 4.2 days is "5 days". Pure. */
export function daysLeft(endsAt: Date, now: Date): number {
  return Math.max(1, Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS));
}

/** The reminder's title and body. Pure; exported for tests. */
export function reminderText(
  productName: string,
  endsAt: Date,
  now: Date,
): { title: string; body: string } {
  const days = daysLeft(endsAt, now);
  const date = endsAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
  return {
    title: `${productName} ends in ${days} day${days === 1 ? "" : "s"}`,
    body: `Your ${productName} subscription ends on ${date}. Renew before then to keep your service running: when it ends, the service is turned off.`,
  };
}

export interface ReminderDeps {
  /** Whether Paddle renews this product for the user by itself. */
  renewsAutomatically(userId: string, productId: string): Promise<boolean>;
  notify(
    userId: string,
    productId: string,
    text: { title: string; body: string },
  ): Promise<void>;
}

const defaultDeps: ReminderDeps = {
  renewsAutomatically: (userId, productId) =>
    mongoBillingProfiles.renewsAutomatically(userId, productId),
  async notify(userId, productId, { title, body }) {
    const link = `/products/${productId}`;
    await notificationService.send(
      { userId, title, body, link, channels: "both" },
      {
        customEmail: (to) =>
          mailer.sendNotification(to, {
            title,
            body,
            url: absoluteLink(env.appBaseUrl, link),
            buttonLabel: "Renew now",
          }),
      },
    );
  },
};

/**
 * Tell owners of subscriptions ending within EXPIRY_REMINDER_DAYS, once per
 * period, by email and in the app. Skipped (but marked) when another period
 * follows right after, when Paddle renews it by itself, or when the product
 * is gone. Returns how many reminders were sent.
 */
export async function remindExpiring(
  now: Date = new Date(),
  deps: ReminderDeps = defaultDeps,
): Promise<number> {
  const until = new Date(now.getTime() + env.expiryReminderDays * DAY_MS);
  const due = await UserProductPeriodModel.find({
    endsAt: { $gt: now, $lte: until },
    reminderSentAt: null,
  })
    .sort({ endsAt: 1 })
    .limit(BATCH)
    .select("userId productId endsAt")
    .lean()
    .exec();

  let sent = 0;
  for (const period of due) {
    const endsAt = period.endsAt!;
    // Claim it first, so two sweeps never remind twice.
    const claimed = await UserProductPeriodModel.updateOne(
      { _id: period._id, reminderSentAt: null },
      { $set: { reminderSentAt: now } },
    ).exec();
    if (claimed.modifiedCount === 0) continue;

    const userId = period.userId.toString();
    const productId = period.productId.toString();
    try {
      const continued = await UserProductPeriodModel.exists({
        userId,
        productId,
        _id: { $ne: period._id },
        startsAt: {
          $gte: new Date(endsAt.getTime() - CONTIGUOUS_MS),
          $lte: new Date(endsAt.getTime() + CONTIGUOUS_MS),
        },
      });
      if (continued) continue;
      if (await deps.renewsAutomatically(userId, productId)) continue;
      const product = await ProductModel.findById(productId)
        .select("name deletedAt")
        .lean()
        .exec();
      if (!product || product.deletedAt) continue;

      await deps.notify(userId, productId, reminderText(product.name, endsAt, now));
      sent += 1;
    } catch (error) {
      // Let the next sweep try again.
      await UserProductPeriodModel.updateOne(
        { _id: period._id },
        { $set: { reminderSentAt: null } },
      ).exec();
      logger.error(
        `Expiry reminder for period ${period._id.toString()} failed: ${error instanceof Error ? error.message : String(error)}`,
        SOURCE,
        "remindExpiring",
      );
    }
  }
  if (sent > 0) {
    logger.info(`Sent ${sent} expiry reminder(s)`, SOURCE, "remindExpiring");
  }
  return sent;
}
