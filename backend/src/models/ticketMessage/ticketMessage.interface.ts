import { Types } from "mongoose";
import type { TicketStatus } from "../ticket/ticket.interface";

export const SENDER_ROLES = ["user", "admin"] as const;
export type SenderRole = (typeof SENDER_ROLES)[number];

/** "message": someone wrote; "status": an admin changed the status. */
export const TICKET_ENTRY_KINDS = ["message", "status"] as const;
export type TicketEntryKind = (typeof TICKET_ENTRY_KINDS)[number];

/** A photo in the private "ticketAttachments" bucket. Never a public URL. */
export interface TicketAttachment {
  fileId: Types.ObjectId;
  /** The object's name in the bucket: `{ticketId}/{messageId}.webp`. */
  path: string;
}

/** One entry of a ticket's thread. */
export interface TicketMessageInterface {
  ticketId: Types.ObjectId;
  kind: TicketEntryKind;
  senderId: Types.ObjectId;
  senderRole: SenderRole;
  /** Plain text, as typed. Empty for a status change. */
  body: string;
  attachment: TicketAttachment | null;
  /** Status changes only. */
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus | null;
  createdAt?: Date;
  updatedAt?: Date;
}
