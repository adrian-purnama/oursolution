import { Types, type HydratedDocument } from "mongoose";
import {
  deleteTicketFile,
  findTicketFile,
  openTicketDownload,
  uploadTicketFile,
} from "../../buckets/ticketBucket";
import type {
  TicketMessageOutDto,
  TicketOutDto,
  TicketPageOutDto,
  TicketSummaryOutDto,
} from "../../dto/ticket.dto";
import { env } from "../../environment/env";
import { logger } from "../../logger/logger";
import type {
  TicketInterface,
  TicketStatus,
} from "../../models/ticket/ticket.interface";
import { TicketModel } from "../../models/ticket/ticket.model";
import type {
  TicketAttachment,
  TicketMessageInterface,
} from "../../models/ticketMessage/ticketMessage.interface";
import { TicketMessageModel } from "../../models/ticketMessage/ticketMessage.model";
import { UserModel } from "../../models/user/user.model";
import { signLink, verifyLink } from "../../utils/signedLink";
import { processTicketImage } from "../../utils/ticketImage";
import { escapeRegex } from "../../validation/adminUser";
import { PAGE_SIZE } from "../../validation/ticket";

const SOURCE = "modules/ticket/ticket.service.ts";

/** Customer messages allowed between two admin replies. */
export const MAX_FOLLOWUPS = 3;
/** Tickets a customer may have that are not closed. */
export const MAX_OPEN_TICKETS = 5;
export const MAX_TICKETS_PER_HOUR = 5;
export const MAX_MESSAGES_PER_MINUTE = 10;

const HOUR_MS = 60 * 60_000;
const MINUTE_MS = 60_000;

type TicketDoc = HydratedDocument<TicketInterface>;
type MessageDoc = HydratedDocument<TicketMessageInterface>;
type Photo = { buffer: Buffer; contentType: string };

export type TicketView = "customer" | "admin";

export const TICKET_ERROR_CODES = {
  notFound: "TICKET_NOT_FOUND",
  closed: "TICKET_CLOSED",
  followupLimit: "FOLLOWUP_LIMIT_REACHED",
  openLimit: "OPEN_TICKET_LIMIT_REACHED",
  rateLimited: "RATE_LIMITED",
} as const;

/** A refusal with an HTTP status and a code the page can act on. */
export class TicketError extends Error {
  constructor(
    message: string,
    readonly status: 403 | 404 | 429,
    readonly code: string,
  ) {
    super(message);
  }
}

const notFound = () =>
  new TicketError("Ticket not found", 404, TICKET_ERROR_CODES.notFound);

/** A photo as sent; checked and re-encoded before anything is stored. */
export type IncomingImage = Buffer | null;

function remaining(ticket: TicketInterface): number {
  return Math.max(0, MAX_FOLLOWUPS - ticket.followupCount);
}

/** The admin did something the customer has not looked at yet. */
function isUnread(ticket: TicketInterface): boolean {
  return (
    ticket.adminActivityAt !== null &&
    (ticket.userSeenAt === null || ticket.adminActivityAt > ticket.userSeenAt)
  );
}

/** Tickets with something new for the customer, as a MongoDB filter. */
const UNREAD_FILTER = {
  adminActivityAt: { $ne: null },
  $expr: {
    $or: [
      { $eq: [{ $ifNull: ["$userSeenAt", null] }, null] },
      { $gt: ["$adminActivityAt", "$userSeenAt"] },
    ],
  },
};

function imagePath(ticketId: Types.ObjectId, messageId: Types.ObjectId) {
  return `${ticketId.toString()}/${messageId.toString()}.webp`;
}

/** Where the page loads a message's photo from, signed for a few minutes. */
function signedImageUrl(messageId: string): string {
  const { exp, sig } = signLink(env.mediaSigningSecret, messageId);
  return `/tickets/attachments/${messageId}?exp=${exp}&sig=${sig}`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Support tickets. Customers open them and add messages; after
 * MAX_FOLLOWUPS messages they wait for an admin reply, which gives them
 * MAX_FOLLOWUPS again. Every limit is checked here, never only on the page.
 */
export class TicketService {
  // ---------------------------------------------------------------- customer

  async create(
    userId: string,
    input: { subject: string; description: string },
    image: IncomingImage,
  ): Promise<TicketOutDto> {
    const owner = new Types.ObjectId(userId);
    const [open, lastHour] = await Promise.all([
      TicketModel.countDocuments({ userId: owner, status: { $ne: "closed" } }),
      TicketModel.countDocuments({
        userId: owner,
        createdAt: { $gt: new Date(Date.now() - HOUR_MS) },
      }),
    ]);
    if (open >= MAX_OPEN_TICKETS) {
      throw new TicketError(
        `You can have at most ${MAX_OPEN_TICKETS} open tickets. Wait until one is closed`,
        429,
        TICKET_ERROR_CODES.openLimit,
      );
    }
    if (lastHour >= MAX_TICKETS_PER_HOUR) {
      throw new TicketError(
        "You opened many tickets in the last hour. Try again later",
        429,
        TICKET_ERROR_CODES.rateLimited,
      );
    }
    await this.assertMessageRate(owner);
    const photo = image ? await processTicketImage(image) : null;

    const ticket = await TicketModel.create({
      userId: owner,
      subject: input.subject,
      status: "open",
      followupCount: 0,
      lastAdminReplyAt: null,
      adminActivityAt: null,
      userSeenAt: new Date(),
    });
    try {
      await this.insertMessage(ticket, owner, "user", input.description, photo);
    } catch (error) {
      // No ticket without its first message.
      await TicketModel.deleteOne({ _id: ticket._id }).exec();
      throw error;
    }
    return this.toOut(ticket, "customer");
  }

  async listOwn(userId: string, page: number): Promise<TicketPageOutDto> {
    const filter = { userId: new Types.ObjectId(userId) };
    const [tickets, total] = await Promise.all([
      TicketModel.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .exec(),
      TicketModel.countDocuments(filter),
    ]);
    return {
      items: tickets.map((ticket) => this.toSummary(ticket)),
      total,
      page,
      pageSize: PAGE_SIZE,
    };
  }

  /**
   * The customer's own ticket; someone else's is "not found". Opening it
   * marks what the admins did as seen.
   */
  async getOwn(userId: string, ticketId: string): Promise<TicketOutDto> {
    const ticket = await TicketModel.findOneAndUpdate(
      { _id: ticketId, userId: new Types.ObjectId(userId) },
      { $set: { userSeenAt: new Date() } },
      { new: true, timestamps: false },
    ).exec();
    if (!ticket) throw notFound();
    return this.toOut(ticket, "customer");
  }

  /** How many of the customer's tickets have a reply or change they have not seen. */
  async unreadCount(userId: string): Promise<number> {
    return TicketModel.countDocuments({
      userId: new Types.ObjectId(userId),
      ...UNREAD_FILTER,
    });
  }

  /**
   * A customer's follow-up. A slot is taken first, in one update that
   * also checks the ticket is theirs and not closed, so two at once can
   * never both get the last one. It is given back if storing fails.
   */
  async addUserMessage(
    userId: string,
    ticketId: string,
    body: string,
    image: IncomingImage,
  ): Promise<TicketOutDto> {
    const owner = new Types.ObjectId(userId);
    await this.assertMessageRate(owner);
    const photo = image ? await processTicketImage(image) : null;

    const ticket = await TicketModel.findOneAndUpdate(
      {
        _id: ticketId,
        userId: owner,
        status: { $ne: "closed" },
        followupCount: { $lt: MAX_FOLLOWUPS },
      },
      { $inc: { followupCount: 1 }, $set: { userSeenAt: new Date() } },
      { new: true },
    ).exec();
    if (!ticket) throw await this.whyRefused(owner, ticketId);

    try {
      await this.insertMessage(ticket, owner, "user", body, photo);
    } catch (error) {
      // Only while above 0: an admin may have replied meanwhile.
      await TicketModel.updateOne(
        { _id: ticket._id, followupCount: { $gt: 0 } },
        { $inc: { followupCount: -1 } },
      ).exec();
      throw error;
    }
    return this.toOut(ticket, "customer");
  }

  private async whyRefused(
    owner: Types.ObjectId,
    ticketId: string,
  ): Promise<TicketError> {
    const ticket = await TicketModel.findOne({ _id: ticketId, userId: owner })
      .select("status")
      .exec();
    if (!ticket) return notFound();
    if (ticket.status === "closed") {
      return new TicketError(
        "This ticket is closed",
        403,
        TICKET_ERROR_CODES.closed,
      );
    }
    return new TicketError(
      "Waiting for admin response. You can send more once an admin replies",
      429,
      TICKET_ERROR_CODES.followupLimit,
    );
  }

  /** Counted from stored messages, so it holds across restarts. */
  private async assertMessageRate(sender: Types.ObjectId): Promise<void> {
    const recent = await TicketMessageModel.countDocuments({
      senderId: sender,
      kind: "message",
      createdAt: { $gt: new Date(Date.now() - MINUTE_MS) },
    });
    if (recent >= MAX_MESSAGES_PER_MINUTE) {
      throw new TicketError(
        "You are sending messages too quickly. Wait a minute",
        429,
        TICKET_ERROR_CODES.rateLimited,
      );
    }
  }

  // ---------------------------------------------------------------- admin

  /** Every ticket, filtered by status and by subject or customer email. */
  async listAll(query: {
    page: number;
    status: TicketStatus | null;
    search: string;
  }): Promise<TicketPageOutDto> {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.search) {
      const pattern = new RegExp(escapeRegex(query.search), "i");
      const users = await UserModel.find({ email: pattern })
        .select("_id")
        .limit(500)
        .exec();
      filter.$or = [
        { subject: pattern },
        { userId: { $in: users.map((user) => user._id) } },
      ];
    }
    const [tickets, total] = await Promise.all([
      TicketModel.find(filter)
        .sort({ updatedAt: -1 })
        .skip((query.page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .exec(),
      TicketModel.countDocuments(filter),
    ]);
    const emails = await this.emailsOf(tickets.map((ticket) => ticket.userId));
    return {
      items: tickets.map((ticket) => this.toSummary(ticket, emails)),
      total,
      page: query.page,
      pageSize: PAGE_SIZE,
    };
  }

  async getAny(ticketId: string): Promise<TicketOutDto> {
    const ticket = await TicketModel.findById(ticketId).exec();
    if (!ticket) throw notFound();
    return this.toOut(ticket, "admin");
  }

  /**
   * An admin reply: the customer's count goes back to 0, and an open
   * ticket moves to in progress. A closed ticket stays closed.
   */
  async addAdminMessage(
    adminId: string,
    ticketId: string,
    body: string,
    image: IncomingImage,
  ): Promise<TicketOutDto> {
    const admin = new Types.ObjectId(adminId);
    const ticket = await TicketModel.findById(ticketId).exec();
    if (!ticket) throw notFound();
    const photo = image ? await processTicketImage(image) : null;

    await this.insertMessage(ticket, admin, "admin", body, photo);
    await TicketModel.updateOne(
      { _id: ticket._id },
      {
        $set: {
          followupCount: 0,
          lastAdminReplyAt: new Date(),
          adminActivityAt: new Date(),
        },
      },
    ).exec();
    const moved = await TicketModel.updateOne(
      { _id: ticket._id, status: "open" },
      { $set: { status: "in_progress" } },
    ).exec();
    if (moved.modifiedCount > 0) {
      await this.recordStatus(ticket._id, admin, "open", "in_progress");
    }
    return this.getAny(ticketId);
  }

  /** Any status, reopening included. Saved in the thread and logged. */
  async setStatus(
    adminId: string,
    ticketId: string,
    status: TicketStatus,
  ): Promise<TicketOutDto> {
    const admin = new Types.ObjectId(adminId);
    const before = await TicketModel.findOneAndUpdate(
      { _id: ticketId },
      { $set: { status } },
      { new: false },
    ).exec();
    if (!before) throw notFound();
    if (before.status !== status) {
      await TicketModel.updateOne(
        { _id: before._id },
        { $set: { adminActivityAt: new Date() } },
      ).exec();
      await this.recordStatus(before._id, admin, before.status, status);
    }
    return this.getAny(ticketId);
  }

  private async recordStatus(
    ticketId: Types.ObjectId,
    admin: Types.ObjectId,
    from: TicketStatus,
    to: TicketStatus,
  ): Promise<void> {
    await TicketMessageModel.create({
      ticketId,
      kind: "status",
      senderId: admin,
      senderRole: "admin",
      body: "",
      attachment: null,
      fromStatus: from,
      toStatus: to,
    });
    logger.info(
      `Ticket ${ticketId.toString()}: status ${from} -> ${to} by admin ${admin.toString()} at ${new Date().toISOString()}`,
      SOURCE,
      "recordStatus",
    );
  }

  // ---------------------------------------------------------------- photos

  /**
   * A message's photo, through a link that toOut signs only for the
   * ticket's owner and admins. "denied" for a bad or expired link.
   */
  async openAttachment(
    messageId: string,
    exp: unknown,
    sig: unknown,
  ): Promise<
    | { status: "denied" }
    | { status: "missing" }
    | {
        status: "ok";
        secondsLeft: number;
        stream: ReturnType<typeof openTicketDownload>;
      }
  > {
    const secondsLeft = verifyLink(env.mediaSigningSecret, messageId, exp, sig);
    if (secondsLeft === null) return { status: "denied" };
    const message = await TicketMessageModel.findById(messageId)
      .select("attachment")
      .exec();
    const fileId = message?.attachment?.fileId;
    if (!fileId || !(await findTicketFile(fileId))) {
      return { status: "missing" };
    }
    return {
      status: "ok",
      secondsLeft,
      stream: openTicketDownload(fileId),
    };
  }

  // ---------------------------------------------------------------- helpers

  /** Stores the photo, then the message; no photo is left without one. */
  private async insertMessage(
    ticket: TicketDoc,
    sender: Types.ObjectId,
    role: "user" | "admin",
    body: string,
    photo: Photo | null,
  ): Promise<MessageDoc> {
    const messageId = new Types.ObjectId();
    let attachment: TicketAttachment | null = null;
    if (photo) {
      const path = imagePath(ticket._id, messageId);
      const file = await uploadTicketFile({
        buffer: photo.buffer,
        path,
        contentType: photo.contentType,
        ticketId: ticket._id,
        messageId,
      });
      attachment = { fileId: file.id, path };
    }
    try {
      return await this.saveMessage({
        _id: messageId,
        ticketId: ticket._id,
        kind: "message",
        senderId: sender,
        senderRole: role,
        body,
        attachment,
        fromStatus: null,
        toStatus: null,
      });
    } catch (error) {
      if (attachment) {
        const { fileId, path } = attachment;
        await deleteTicketFile(fileId).catch((cleanup: unknown) => {
          logger.error(
            `Could not delete orphaned ticket photo ${path}: ${messageOf(cleanup)}`,
            SOURCE,
            "insertMessage",
          );
        });
      }
      throw error;
    }
  }

  /** Separate so tests can make storing a message fail. */
  async saveMessage(
    fields: TicketMessageInterface & { _id: Types.ObjectId },
  ): Promise<MessageDoc> {
    return TicketMessageModel.create(fields);
  }

  private async emailsOf(
    ids: Types.ObjectId[],
  ): Promise<Map<string, string>> {
    const users = await UserModel.find({ _id: { $in: ids } })
      .select("email")
      .exec();
    return new Map(users.map((user) => [String(user._id), user.email]));
  }

  private toSummary(
    ticket: TicketDoc,
    emails?: Map<string, string>,
  ): TicketSummaryOutDto {
    const userId = ticket.userId.toString();
    return {
      id: String(ticket._id),
      subject: ticket.subject,
      status: ticket.status,
      followupCount: ticket.followupCount,
      followupsRemaining: remaining(ticket),
      createdAt: (ticket.createdAt ?? new Date()).toISOString(),
      updatedAt: (ticket.updatedAt ?? new Date()).toISOString(),
      unread: emails ? false : isUnread(ticket),
      ...(emails
        ? {
            user: {
              id: userId,
              email: emails.get(userId) ?? "(deleted user)",
            },
          }
        : {}),
    };
  }

  /** Read fresh, so counts and status include what just changed. */
  private async toOut(
    stale: TicketDoc,
    view: TicketView,
  ): Promise<TicketOutDto> {
    const ticket = (await TicketModel.findById(stale._id).exec()) ?? stale;
    const messages = await TicketMessageModel.find({ ticketId: ticket._id })
      .sort({ createdAt: 1, _id: 1 })
      .exec();
    const emails =
      view === "admin"
        ? await this.emailsOf([
            ticket.userId,
            ...messages.map((message) => message.senderId),
          ])
        : undefined;

    return {
      ...this.toSummary(ticket, emails),
      canSend: ticket.status !== "closed" && remaining(ticket) > 0,
      lastAdminReplyAt: ticket.lastAdminReplyAt?.toISOString() ?? null,
      messages: messages.map(
        (message): TicketMessageOutDto => ({
          id: String(message._id),
          kind: message.kind,
          senderRole: message.senderRole,
          ...(emails
            ? { senderEmail: emails.get(message.senderId.toString()) }
            : {}),
          body: message.body,
          imageUrl: message.attachment
            ? signedImageUrl(String(message._id))
            : null,
          fromStatus: message.fromStatus,
          toStatus: message.toStatus,
          createdAt: (message.createdAt ?? new Date()).toISOString(),
        }),
      ),
    };
  }
}

export const ticketService = new TicketService();
