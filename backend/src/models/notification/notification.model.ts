import { model, Schema } from "mongoose";
import {
  NOTIFICATION_CHANNELS,
  type NotificationInterface,
} from "./notification.interface";

/** Notifications older than this are removed by MongoDB. */
export const NOTIFICATION_TTL_DAYS = 90;

const notificationSchema = new Schema<NotificationInterface>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    title: { type: String, required: true },
    body: { type: String, required: true },
    link: { type: String, default: null },
    channels: { type: String, required: true, enum: NOTIFICATION_CHANNELS },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// A user's list, newest first (_id breaks ties for the cursor).
notificationSchema.index({ userId: 1, createdAt: -1, _id: -1 });
// Unread counts and "mark all as read".
notificationSchema.index({ userId: 1, readAt: 1 });
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: NOTIFICATION_TTL_DAYS * 24 * 60 * 60 },
);

export const NotificationModel = model<NotificationInterface>(
  "Notification",
  notificationSchema,
);
