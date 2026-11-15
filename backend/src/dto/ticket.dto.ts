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

/** What the last close recorded; kept when the ticket is reopened. */
export interface TicketClosureOutDto {
  closedAt: string;
  /** Admin view only; null means "Other". */
  productId?: string | null;
  productName?: string | null;
  resolution: string | null;
  summary: string | null;
}

export interface TicketOutDto extends TicketSummaryOutDto {
  /** The customer may send a message now. */
  canSend: boolean;
  lastAdminReplyAt: string | null;
  messages: TicketMessageOutDto[];
  /** Null until the ticket is closed for the first time. */
  closure: TicketClosureOutDto | null;
}

export interface CloseTicketOutDto {
  ticket: TicketOutDto;
  /** False when no summary was asked for, or the model failed. */
  summarized: boolean;
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
