import type { TicketStatus } from "../models/ticket/ticket.interface";
import type {
  SenderRole,
  TicketEntryKind,
} from "../models/ticketMessage/ticketMessage.interface";

export interface TicketMessageOutDto {
  id: string;
  kind: TicketEntryKind;
  senderRole: SenderRole;
  /** Admins see who; customers see only "admin" or themselves. */
  senderEmail?: string;
  body: string;
  /** A signed link that works for a few minutes; null without a photo. */
  imageUrl: string | null;
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus | null;
  createdAt: string;
}

export interface TicketSummaryOutDto {
  id: string;
  subject: string;
  status: TicketStatus;
  followupCount: number;
  followupsRemaining: number;
  createdAt: string;
  updatedAt: string;
  /** Customer view: an admin replied or changed the status since they looked. */
  unread: boolean;
  /** Admin view only. */
  user?: { id: string; email: string };
}

export interface TicketOutDto extends TicketSummaryOutDto {
  /** The customer may send a message now. */
  canSend: boolean;
  lastAdminReplyAt: string | null;
  messages: TicketMessageOutDto[];
}

export interface TicketPageOutDto {
  items: TicketSummaryOutDto[];
  total: number;
  page: number;
  pageSize: number;
}

/** `data` of a refused request, so the page can tell why. */
export interface TicketErrorDataDto {
  code: string;
}
