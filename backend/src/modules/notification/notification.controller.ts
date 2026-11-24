import type { Request, Response } from "express";
import type {
  NotificationOutDto,
  NotificationPageOutDto,
  ReadAllOutDto,
  UnreadCountOutDto,
} from "../../dto/notification.dto";
import { logger } from "../../logger/logger";
import {
  parseLastEventId,
  parseNotificationListQuery,
} from "../../validation/notification";
import { parseRouteId } from "../../validation/parseParam";
import { notificationService } from "./notification.service";
import {
  formatNotificationEvent,
  HEARTBEAT_MS,
  notificationStreams,
} from "./notification.stream";
import { fail, ok } from "../../utils/respond";

const SOURCE = "modules/notification/notification.controller.ts";

/** The signed-in user's own notifications. */
export class NotificationController {
  list = async (req: Request, res: Response) => {
    try {
      const query = parseNotificationListQuery(req.query);
      return ok<NotificationPageOutDto>(
        res,
        "Notifications retrieved",
        await notificationService.list(req.user!.id, query),
      );
    } catch (error) {
      return fail(res, error, "Failed to load notifications");
    }
  };

  unreadCount = async (req: Request, res: Response) => {
    try {
      return ok<UnreadCountOutDto>(res, "Unread count retrieved", {
        count: await notificationService.unreadCount(req.user!.id),
      });
    } catch (error) {
      return fail(res, error, "Failed to load the unread count");
    }
  };

  markRead = async (req: Request, res: Response) => {
    try {
      return ok<NotificationOutDto>(
        res,
        "Notification marked as read",
        await notificationService.markRead(
          req.user!.id,
          parseRouteId(req.params.id),
        ),
      );
    } catch (error) {
      return fail(res, error, "Could not update the notification");
    }
  };

  markAllRead = async (req: Request, res: Response) => {
    try {
      return ok<ReadAllOutDto>(res, "All notifications marked as read", {
        updated: await notificationService.markAllRead(req.user!.id),
      });
    } catch (error) {
      return fail(res, error, "Could not update notifications");
    }
  };

  /**
   * Server-sent events: `notification` events as they are created. With
   * Last-Event-ID, the ones missed since then are sent first.
   */
  stream = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const lastEventId = parseLastEventId(req.headers["last-event-id"]);

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    res.write(": connected\n\n");

    // Registered before the replay, so nothing created meanwhile is lost
    // (the client ignores an id it already has).
    const unregister = notificationStreams.add(userId, res);
    const heartbeat = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);
    res.on("close", () => {
      clearInterval(heartbeat);
      unregister();
    });

    if (lastEventId) {
      try {
        const missed = await notificationService.missedSince(
          userId,
          lastEventId,
        );
        if (!res.writableEnded) {
          for (const item of missed) res.write(formatNotificationEvent(item));
        }
      } catch (error) {
        logger.error(
          `Failed to replay notifications: ${error instanceof Error ? error.message : String(error)}`,
          SOURCE,
          "stream",
        );
      }
    }
  };
}
