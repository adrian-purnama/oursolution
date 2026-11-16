import mongoose, { Types, type HydratedDocument } from "mongoose";
import {
  deleteTicketFile,
  deleteTicketFilesOf,
  findTicketFile,
  openTicketDownload,
  uploadTicketFile,
} from "../../buckets/ticketBucket";
import type {
  CloseTicketOutDto,
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
import { ProductModel } from "../../models/product/product.model";
import { UserModel } from "../../models/user/user.model";
import { signLink, verifyLink } from "../../utils/signedLink";
import { processTicketImage } from "../../utils/ticketImage";
import { escapeRegex } from "../../validation/adminUser";
import { PAGE_SIZE, type CloseTicketInput } from "../../validation/ticket";
import { LlmError, llmService, type LlmClient } from "../llm/llm.service";
import { mailer } from "../mail/mail.service";
import {
  absoluteLink,
  notificationService,
  type NotificationMailer,
  type SendNotificationOptions,
} from "../notification/notification.service";
import { buildSummaryPrompt, sanitizeSummary } from "./ticket.summary";

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
  alreadyClosed: "TICKET_ALREADY_CLOSED",
  invalidProduct: "INVALID_PRODUCT",
  useCloseEndpoint: "USE_CLOSE_ENDPOINT",
} as const;

/** A refusal with an HTTP status and a code the page can act on. */
export class TicketError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 429,
    readonly code: string,
  ) {
    super(message);
  }
}

const notFound = () =>
  new TicketError("Ticket not found", 404, TICKET_ERROR_CODES.notFound);

const alreadyClosed = () =>
  new TicketError(
    "This ticket is already closed",
    409,
    TICKET_ERROR_CODES.alreadyClosed,
  );

/** What closing a ticket talks to, so tests can pass stubs. */
export interface TicketServiceDeps {
  llm: LlmClient;
  notifications: {
    send(input: unknown, options?: SendNotificationOptions): Promise<unknown>;
  };
  mailer: NotificationMailer;
  appBaseUrl: string;
}

function defaultDeps(): TicketServiceDeps {
  return {
    llm: llmService,
    notifications: notificationService,
    mailer,
    appBaseUrl: env.appBaseUrl,
  };
}

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
  constructor(private readonly deps: TicketServiceDeps = defaultDeps()) {}

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

  /**
   * Open or in progress, reopening included. Saved in the thread and
   * logged. Closing goes through `close` only.
   */
  async setStatus(
    adminId: string,
    ticketId: string,
    status: TicketStatus,
  ): Promise<TicketOutDto> {
    if (status === "closed") {
      throw new TicketError(
        "Close a ticket with the close dialog",
        400,
        TICKET_ERROR_CODES.useCloseEndpoint,
      );
    }
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

  /**
   * Closes a ticket with a product ("Other" when null) and the admin's
   * resolution. With `summarize`, the model's summary replaces the thread:
   * messages and photos are deleted, status changes stay. If the model
   * fails, the ticket closes the plain way and nothing is deleted. Of two
   * concurrent closes only one succeeds; the other gets 409.
   */
  async close(
    adminId: string,
    ticketId: string,
    input: CloseTicketInput,
  ): Promise<CloseTicketOutDto> {
    const admin = new Types.ObjectId(adminId);
    const ticket = await TicketModel.findById(ticketId).exec();
    if (!ticket) throw notFound();
    if (ticket.status === "closed") throw alreadyClosed();

    let product: { _id: Types.ObjectId; name: string } | null = null;
    if (input.productId) {
      product = await ProductModel.findById(input.productId)
        .select("name")
        .lean<{ _id: Types.ObjectId; name: string }>()
        .exec();
      if (!product) {
        throw new TicketError(
          "Product not found",
          400,
          TICKET_ERROR_CODES.invalidProduct,
        );
      }
    }

    const summary = input.summarize
      ? await this.summarize(ticket, product?.name ?? null, input.resolution)
      : null;

    const closedAt = new Date();
    const update = {
      $set: {
        status: "closed" as const,
        productId: product?._id ?? null,
        productName: product?.name ?? null,
        closedAt,
        closedBy: admin,
        adminActivityAt: closedAt,
        ...(summary
          ? { summary, resolution: null }
          : { resolution: input.resolution }),
      },
    };
    const filter = { _id: ticket._id, status: { $ne: "closed" as const } };

    const closing: { before: TicketDoc | null; messagesDeleted: boolean } = {
      before: null,
      messagesDeleted: false,
    };
    if (summary && (await this.isReplicaSet())) {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          closing.before = await TicketModel.findOneAndUpdate(filter, update, {
            returnDocument: "before",
            session,
          }).exec();
          if (closing.before) {
            await TicketMessageModel.deleteMany(
              { ticketId: ticket._id, kind: "message" },
              { session },
            ).exec();
          }
        });
        closing.messagesDeleted = closing.before !== null;
      } finally {
        await session.endSession();
      }
    } else {
      closing.before = await TicketModel.findOneAndUpdate(filter, update, {
        returnDocument: "before",
      }).exec();
    }
    const before = closing.before;
    if (!before) {
      throw (await TicketModel.exists({ _id: ticket._id }))
        ? alreadyClosed()
        : notFound();
    }

    await this.recordStatus(ticket._id, admin, before.status, "closed");
    if (summary) await this.deleteThread(ticket._id, !closing.messagesDeleted);
    await this.notifyClosed(ticket, input.resolution, summary);
    return {
      ticket: await this.getAny(ticketId),
      summarized: summary !== null,
    };
  }

  /** The summary, or null after logging why there is none. */
  private async summarize(
    ticket: TicketDoc,
    productName: string | null,
    resolution: string,
  ): Promise<string | null> {
    const id = ticket._id.toString();
    try {
      const messages = await TicketMessageModel.find({
        ticketId: ticket._id,
        kind: "message",
      })
        .sort({ createdAt: 1, _id: 1 })
        .select("senderRole body")
        .lean()
        .exec();
      const reply = await this.deps.llm.chat({
        messages: buildSummaryPrompt({
          subject: ticket.subject,
          productName,
          messages: messages.map((message) => ({
            role: message.senderRole,
            body: message.body,
          })),
          resolution,
        }),
      });
      const summary = sanitizeSummary(reply);
      if (!summary) {
        logger.warn(
          `Ticket ${id}: the summary was empty; closing without one`,
          SOURCE,
          "summarize",
        );
      }
      return summary;
    } catch (error) {
      const reason = error instanceof LlmError ? error.code : "UNEXPECTED";
      logger.warn(
        `Ticket ${id}: no summary (${reason}); closing without one`,
        SOURCE,
        "summarize",
      );
      return null;
    }
  }

  /**
   * After a summarized close: the messages (unless a transaction already
   * removed them), then the photos. Both can run again safely; a failure
   * is logged and the close stands.
   */
  private async deleteThread(
    ticketId: Types.ObjectId,
    messagesToo: boolean,
  ): Promise<void> {
    const id = ticketId.toString();
    if (messagesToo) {
      try {
        await TicketMessageModel.deleteMany({
          ticketId,
          kind: "message",
        }).exec();
      } catch (error) {
        logger.error(
          `Ticket ${id}: messages could not be deleted after the summary: ${messageOf(error)}`,
          SOURCE,
          "deleteThread",
        );
      }
    }
    try {
      await deleteTicketFilesOf(ticketId);
    } catch (error) {
      logger.error(
        `Ticket ${id}: photos could not be deleted after the summary: ${messageOf(error)}`,
        SOURCE,
        "deleteThread",
      );
    }
  }

  /**
   * In-app and email. The email carries the AI summary (when the close was
   * summarized) and the full resolution, which the in-app notification and
   * a summarized ticket do not. Failing here never undoes the close.
   */
  private async notifyClosed(
    ticket: TicketDoc,
    resolution: string,
    summary: string | null,
  ): Promise<void> {
    const id = ticket._id.toString();
    const link = `/support/${id}`;
    const title = "Your ticket was closed";
    const body = `Your support ticket "${ticket.subject}" was closed.`;
    const emailBody = [
      body,
      ...(summary ? [`Summary:\n${summary}`] : []),
      `Resolution:\n${resolution}`,
    ].join("\n\n");
    const url = absoluteLink(this.deps.appBaseUrl, link);
    try {
      await this.deps.notifications.send(
        {
          userId: ticket.userId.toString(),
          title,
          body,
          link,
          channels: "both",
        },
        {
          customEmail: (to) =>
            this.deps.mailer.sendNotification(to, {
              title,
              body: emailBody,
              url,
            }),
        },
      );
    } catch (error) {
      logger.error(
        `Ticket ${id}: the closing notification failed: ${messageOf(error)}`,
        SOURCE,
        "notifyClosed",
      );
    }
  }

  private replicaSet: Promise<boolean> | null = null;

  /** Transactions need a replica set; a standalone server has none. */
  private isReplicaSet(): Promise<boolean> {
    this.replicaSet ??= (async () => {
      try {
        const hello = await mongoose.connection
          .db!.admin()
          .command({ hello: 1 });
        return typeof hello.setName === "string";
      } catch {
        return false;
      }
    })();
    return this.replicaSet;
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
      closure: ticket.closedAt
        ? {
            closedAt: ticket.closedAt.toISOString(),
            ...(view === "admin"
              ? {
                  productId: ticket.productId?.toString() ?? null,
                  productName: ticket.productName ?? null,
                }
              : {}),
            resolution: ticket.resolution ?? null,
            summary: ticket.summary ?? null,
          }
        : null,
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
