import type { NotificationChannels } from "../models/notification/notification.interface";

export interface NotificationOutDto {
  id: string;
  title: string;
  body: string;
  /** An internal relative path, or null. */
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPageOutDto {
  items: NotificationOutDto[];
  /** Pass as `cursor` for the next page; null on the last page. */
  nextCursor: string | null;
}

export interface UnreadCountOutDto {
  count: number;
}

export interface ReadAllOutDto {
  updated: number;
}

/** What `notificationService.send` takes from other services. */
export interface SendNotificationInDto {
  userId?: string;
  userIds?: string[];
  title: string;
  body: string;
  link?: string | null;
  channels: NotificationChannels;
}

export type InAppDelivery =
  | { status: "stored"; notificationId: string; liveConnections: number }
  | { status: "skipped" | "failed"; reason: string };

export type EmailDelivery =
  /** Handed to the mailer in the background; failures are logged. */
  { status: "queued" } | { status: "skipped" | "failed"; reason: string };

export interface SendNotificationResult {
  userId: string;
  inApp: InAppDelivery;
  email: EmailDelivery;
}
