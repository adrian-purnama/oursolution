import { Types } from "mongoose";

export const NOTIFICATION_CHANNELS = ["in_app", "email", "both"] as const;
export type NotificationChannels = (typeof NOTIFICATION_CHANNELS)[number];

/** A message to one user, shown under the bell (see modules/notification). */
export interface NotificationInterface {
  userId: Types.ObjectId;
  /** Plain text, one line (see validation/notification.ts). */
  title: string;
  /** Plain text. */
  body: string;
  /** An internal relative path such as "/support/123", or null. */
  link: string | null;
  /** The channels the sender asked for, kept for audit. */
  channels: NotificationChannels;
  readAt: Date | null;
  createdAt?: Date;
}
