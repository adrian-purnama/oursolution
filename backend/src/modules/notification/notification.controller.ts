import type { Request, Response } from "express";
import { ApiResponseDto } from "../../dto/apiResponse.dto";
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
import {
  NotificationNotFoundError,
  notificationService,
} from "./notification.service";
import {
  formatNotificationEvent,
  HEARTBEAT_MS,
  notificationStreams,
} from "./notification.stream";

const SOURCE = "modules/notification/notification.controller.ts";

function fail(res: Response, error: unknown, fallback: string) {
  if (error instanceof NotificationNotFoundError) {
    return res.status(404).json({
      success: false,
      message: error.message,
      data: null,
    } satisfies ApiResponseDto);
  }
  return res.status(400).json({
    success: false,
    message: error instanceof Error ? error.message : fallback,
    data: null,
  } satisfies ApiResponseDto);
}

/** The signed-in user's own notifications. */
export class NotificationController {
  list = async (req: Request, res: Response) => {
    try {
      const query = parseNotificationListQuery(req.query);
      return res.status(200).json({
        success: true,
        message: "Notifications retrieved",
        data: await notificationService.list(req.user!.id, query),
      } satisfies ApiResponseDto<NotificationPageOutDto>);
    } catch (error) {
      return fail(res, error, "Failed to load notifications");
    }
  };

  unreadCount = async (req: Request, res: Response) => {
    try {
      return res.status(200).json({
        success: true,
        message: "Unread count retrieved",
        data: { count: await notificationService.unreadCount(req.user!.id) },
      } satisfies ApiResponseDto<UnreadCountOutDto>);
    } catch (error) {
      return fail(res, error, "Failed to load the unread count");
    }
  };

  markRead = async (req: Request, res: Response) => {
    try {
      return res.status(200).json({
        success: true,
        message: "Notification marked as read",
        data: await notificationService.markRead(
          req.user!.id,
          parseRouteId(req.params.id),
        ),
      } satisfies ApiResponseDto<NotificationOutDto>);
    } catch (error) {
      return fail(res, error, "Could not update the notification");
    }
  };

  markAllRead = async (req: Request, res: Response) => {
    try {
      return res.status(200).json({
        success: true,
        message: "All notifications marked as read",
        data: { updated: await notificationService.markAllRead(req.user!.id) },
      } satisfies ApiResponseDto<ReadAllOutDto>);
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
