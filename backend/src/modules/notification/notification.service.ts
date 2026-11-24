import { HydratedDocument, Types } from "mongoose";
import type {
  EmailDelivery,
  InAppDelivery,
  NotificationOutDto,
  NotificationPageOutDto,
  SendNotificationResult,
} from "../../dto/notification.dto";
import { env } from "../../environment/env";
import { logger } from "../../logger/logger";
import type { NotificationInterface } from "../../models/notification/notification.interface";
import { NotificationModel } from "../../models/notification/notification.model";
import { UserModel } from "../../models/user/user.model";
import {
  isSafeInternalLink,
  parseSendNotificationInDto,
} from "../../validation/notification";
import { mailer } from "../mail/mail.service";
import {
  notificationStreams,
  type NotificationStreamHub,
} from "./notification.stream";
import { UserError } from "../../utils/userError";

const SOURCE = "modules/notification/notification.service.ts";
/** How many missed notifications a reconnecting stream gets at most. */
export const REPLAY_LIMIT = 100;

export class NotificationNotFoundError extends UserError {
  constructor() {
    super("Notification not found", 404);
  }
}

type NotificationDoc = Pick<
  HydratedDocument<NotificationInterface>,
  "_id" | "title" | "body" | "link" | "readAt" | "createdAt"
>;

export function toNotificationOutDto(doc: NotificationDoc): NotificationOutDto {
  return {
    id: doc._id.toString(),
    title: doc.title,
    body: doc.body,
    link: doc.link ?? null,
    readAt: doc.readAt ? doc.readAt.toISOString() : null,
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
  };
}

/** The absolute URL of an internal link for emails, or null. */
export function absoluteLink(
  baseUrl: string,
  link: string | null,
): string | null {
  if (!link || !isSafeInternalLink(link)) return null;
  return `${baseUrl.replace(/\/+$/, "")}${link}`;
}

/** Newer than `pivot` in list order (createdAt, then _id). */
function after(pivot: { _id: Types.ObjectId; createdAt?: Date }) {
  return {
    $or: [
      { createdAt: { $gt: pivot.createdAt } },
      { createdAt: pivot.createdAt, _id: { $gt: pivot._id } },
    ],
  };
}

function before(pivot: { _id: Types.ObjectId; createdAt?: Date }) {
  return {
    $or: [
      { createdAt: { $lt: pivot.createdAt } },
      { createdAt: pivot.createdAt, _id: { $lt: pivot._id } },
    ],
  };
}

export interface NotificationMailer {
  sendNotification(
    to: string,
    notification: { title: string; body: string; url: string | null },
  ): Promise<boolean>;
}

export interface SendNotificationOptions {
  /**
   * Sends this notification's email in place of the generic template, for
   * mail with its own layout or attachments (such as an invoice PDF).
   * Called in the background once per recipient; return false on failure.
   */
  customEmail?: (to: string) => Promise<boolean>;
}

export interface NotificationServiceDeps {
  mailer: NotificationMailer;
  streams: NotificationStreamHub;
  appBaseUrl: string;
}

/**
 * The only way to notify users. Other services call `send`; the user-facing
 * API reads and marks their own notifications.
 */
export class NotificationService {
  /** Emails still being sent, so tests and shutdown can wait for them. */
  private readonly pendingEmails = new Set<Promise<void>>();

  constructor(private readonly deps: NotificationServiceDeps) {}

  /**
   * Notifies one or more users in the app, by email, or both. Throws
   * NotificationInputError on invalid input only; delivery problems are
   * reported per recipient. Emails go out in the background.
   */
  async send(
    input: unknown,
    options: SendNotificationOptions = {},
  ): Promise<SendNotificationResult[]> {
    const { userIds, title, body, link, channels } =
      parseSendNotificationInDto(input);
    const wantsInApp = channels !== "email";
    const wantsEmail = channels !== "in_app";

    let users: { _id: Types.ObjectId; email: string }[];
    try {
      users = await UserModel.find(
        { _id: { $in: userIds } },
        { email: 1 },
      ).lean();
    } catch (error) {
      logger.error(
        `Failed to look up notification recipients: ${error instanceof Error ? error.message : String(error)}`,
        SOURCE,
        "send",
      );
      const reason = "Recipients could not be looked up";
      return userIds.map((userId) => ({
        userId,
        inApp: wantsInApp
          ? { status: "failed", reason }
          : { status: "skipped", reason: "Not requested" },
        email: wantsEmail
          ? { status: "failed", reason }
          : { status: "skipped", reason: "Not requested" },
      }));
    }
    const emailById = new Map(users.map((u) => [u._id.toString(), u.email]));

    const inApp = new Map<string, InAppDelivery>();
    const known = userIds.filter((id) => emailById.has(id));
    for (const id of userIds) {
      if (!emailById.has(id)) {
        inApp.set(id, { status: "skipped", reason: "Unknown user" });
      } else if (!wantsInApp) {
        inApp.set(id, { status: "skipped", reason: "Not requested" });
      }
    }

    if (wantsInApp && known.length > 0) {
      try {
        const docs = await NotificationModel.insertMany(
          known.map((userId) => ({
            userId: new Types.ObjectId(userId),
            title,
            body,
            link,
            channels,
            readAt: null,
          })),
        );
        for (const doc of docs) {
          const userId = doc.userId.toString();
          const dto = toNotificationOutDto(doc);
          inApp.set(userId, {
            status: "stored",
            notificationId: dto.id,
            liveConnections: this.deps.streams.publish(userId, dto),
          });
        }
      } catch (error) {
        logger.error(
          `Failed to store notifications: ${error instanceof Error ? error.message : String(error)}`,
          SOURCE,
          "send",
        );
        for (const id of known) {
          inApp.set(id, { status: "failed", reason: "Could not be stored" });
        }
      }
    }

    const url = absoluteLink(this.deps.appBaseUrl, link);
    return userIds.map((userId) => {
      const to = emailById.get(userId);
      let email: EmailDelivery;
      if (!wantsEmail) {
        email = { status: "skipped", reason: "Not requested" };
      } else if (!to) {
        email = { status: "skipped", reason: "Unknown user" };
      } else {
        const recipient = to;
        this.mailInBackground(userId, () =>
          options.customEmail
            ? options.customEmail(recipient)
            : this.deps.mailer.sendNotification(recipient, {
                title,
                body,
                url,
              }),
        );
        email = { status: "queued" };
      }
      return { userId, inApp: inApp.get(userId)!, email };
    });
  }

  private mailInBackground(
    userId: string,
    sendEmail: () => Promise<boolean>,
  ): void {
    const job = Promise.resolve()
      .then(sendEmail)
      .then((sent) => {
        if (!sent) {
          logger.error(
            `Notification email to user ${userId} was not sent`,
            SOURCE,
            "send",
          );
        }
      })
      .catch((error: unknown) => {
        logger.error(
          `Notification email to user ${userId} failed: ${error instanceof Error ? error.message : String(error)}`,
          SOURCE,
          "send",
        );
      })
      .finally(() => this.pendingEmails.delete(job));
    this.pendingEmails.add(job);
  }

  /** Resolves once every email started so far has finished. */
  async idle(): Promise<void> {
    while (this.pendingEmails.size > 0) {
      await Promise.all([...this.pendingEmails]);
    }
  }

  async list(
    userId: string,
    options: { cursor: string | null; limit: number },
  ): Promise<NotificationPageOutDto> {
    const filter: Record<string, unknown> = { userId };
    if (options.cursor) {
      const pivot = await NotificationModel.findOne(
        { _id: options.cursor, userId },
        { createdAt: 1 },
      ).lean();
      if (!pivot) throw new Error("Invalid cursor");
      Object.assign(filter, before(pivot));
    }
    const docs = await NotificationModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(options.limit + 1)
      .lean();
    const page = docs.slice(0, options.limit);
    return {
      items: page.map(toNotificationOutDto),
      nextCursor:
        docs.length > options.limit
          ? page[page.length - 1]._id.toString()
          : null,
    };
  }

  /** Notifications created after `lastId`, oldest first, for a reconnect. */
  async missedSince(
    userId: string,
    lastId: string,
  ): Promise<NotificationOutDto[]> {
    const pivot = await NotificationModel.findOne(
      { _id: lastId, userId },
      { createdAt: 1 },
    ).lean();
    // Unknown or expired: nothing to replay; the client refetches anyway.
    if (!pivot) return [];
    const docs = await NotificationModel.find({ userId, ...after(pivot) })
      .sort({ createdAt: 1, _id: 1 })
      .limit(REPLAY_LIMIT)
      .lean();
    return docs.map(toNotificationOutDto);
  }

  async unreadCount(userId: string): Promise<number> {
    return NotificationModel.countDocuments({ userId, readAt: null });
  }

  /** Idempotent; another user's notification is "not found". */
  async markRead(userId: string, id: string): Promise<NotificationOutDto> {
    const doc = await NotificationModel.findOne({ _id: id, userId });
    if (!doc) throw new NotificationNotFoundError();
    if (!doc.readAt) {
      doc.readAt = new Date();
      await NotificationModel.updateOne(
        { _id: doc._id, readAt: null },
        { $set: { readAt: doc.readAt } },
      );
    }
    return toNotificationOutDto(doc);
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await NotificationModel.updateMany(
      { userId, readAt: null },
      { $set: { readAt: new Date() } },
    );
    return result.modifiedCount;
  }
}

export const notificationService = new NotificationService({
  mailer,
  streams: notificationStreams,
  appBaseUrl: env.appBaseUrl,
});
