import { model, Schema } from "mongoose";
import { TICKET_STATUSES, type TicketInterface } from "./ticket.interface";

const ticketSchema = new Schema<TicketInterface>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    subject: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: TICKET_STATUSES,
      default: "open",
    },
    followupCount: { type: Number, required: true, default: 0, min: 0 },
    lastAdminReplyAt: { type: Date, default: null },
    adminActivityAt: { type: Date, default: null },
    userSeenAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// A customer's tickets, and how many they made lately (rate limits).
ticketSchema.index({ userId: 1, createdAt: -1 });
// The admin list: by status, latest activity first.
ticketSchema.index({ status: 1, updatedAt: -1 });

export const TicketModel = model<TicketInterface>("Ticket", ticketSchema);
