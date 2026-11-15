import { model, Schema } from "mongoose";
import { TICKET_STATUSES } from "../ticket/ticket.interface";
import {
  SENDER_ROLES,
  TICKET_ENTRY_KINDS,
  type TicketAttachment,
  type TicketMessageInterface,
} from "./ticketMessage.interface";

const attachmentSchema = new Schema<TicketAttachment>(
  {
    fileId: { type: Schema.Types.ObjectId, required: true },
    path: { type: String, required: true },
  },
  { _id: false },
);

const ticketMessageSchema = new Schema<TicketMessageInterface>(
  {
    ticketId: { type: Schema.Types.ObjectId, required: true, ref: "Ticket" },
    kind: { type: String, required: true, enum: TICKET_ENTRY_KINDS },
    senderId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    senderRole: { type: String, required: true, enum: SENDER_ROLES },
    body: { type: String, default: "" },
    attachment: { type: attachmentSchema, default: null },
    fromStatus: { type: String, enum: [...TICKET_STATUSES, null], default: null },
    toStatus: { type: String, enum: [...TICKET_STATUSES, null], default: null },
  },
  { timestamps: true },
);

// A ticket's thread in order.
ticketMessageSchema.index({ ticketId: 1, createdAt: 1 });
// How many messages someone sent lately (rate limits).
ticketMessageSchema.index({ senderId: 1, createdAt: -1 });

export const TicketMessageModel = model<TicketMessageInterface>(
  "TicketMessage",
  ticketMessageSchema,
);
