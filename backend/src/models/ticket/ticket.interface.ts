import { Types } from "mongoose";

export const TICKET_STATUSES = ["open", "in_progress", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** A support conversation between one customer and the admins. */
export interface TicketInterface {
  userId: Types.ObjectId;
  /** Plain text, as typed (see validation/ticket.ts). */
  subject: string;
  status: TicketStatus;
  /**
   * Customer messages since the last admin reply; the first message of the
   * ticket is not counted. At the limit the customer waits for an admin.
   */
  followupCount: number;
  lastAdminReplyAt: Date | null;
  /** Last admin reply or status change: what the customer may not have seen. */
  adminActivityAt: Date | null;
  /** When the customer last opened or wrote in the ticket. */
  userSeenAt: Date | null;
  /**
   * Set by the last close (POST /admin/tickets/:id/close) and kept when
   * the ticket is reopened. Null product means "Other".
   */
  productId: Types.ObjectId | null;
  /** The product's name when the ticket was closed. */
  productName: string | null;
  /** What the admin wrote; null when the thread was replaced by a summary. */
  resolution: string | null;
  /** AI-written plain text that replaced the thread. */
  summary: string | null;
  closedAt: Date | null;
  closedBy: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}
