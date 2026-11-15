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
  createdAt?: Date;
  updatedAt?: Date;
}
