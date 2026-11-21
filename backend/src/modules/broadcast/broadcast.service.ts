import { HydratedDocument, Types } from "mongoose";
import type {
  BroadcastAudienceInDto,
  BroadcastAudiencePreviewOutDto,
  BroadcastListOutDto,
  BroadcastOutDto,
  BroadcastRecipientDto,
  SendBroadcastInDto,
} from "../../dto/broadcast.dto";
import { env } from "../../environment/env";
import { logger } from "../../logger/logger";
import type {
  BroadcastAudience,
  BroadcastInterface,
} from "../../models/broadcast/broadcast.interface";
import { BroadcastModel } from "../../models/broadcast/broadcast.model";
import type { DeploymentState } from "../../models/deployment/deployment.interface";
import { DeploymentModel } from "../../models/deployment/deployment.model";
import { ProductModel } from "../../models/product/product.model";
import { PurchaseModel } from "../../models/purchase/purchase.model";
import { UserModel } from "../../models/user/user.model";
import { UserProductPeriodModel } from "../../models/userProductPeriod/userProductPeriod.model";
import { MAX_RECIPIENTS as IN_APP_BATCH } from "../../validation/notification";
import { mailer } from "../mail/mail.service";
import {
  absoluteLink,
  notificationService,
} from "../notification/notification.service";

const SOURCE = "modules/broadcast/broadcast.service.ts";
/** Most recipients one email may go to. */
export const MAX_BROADCAST_RECIPIENTS = 5000;
const SAMPLE_SIZE = 20;
/** How often the sent/failed counts are saved while sending. */
const PROGRESS_EVERY = 25;

export const DEPLOYMENT_STATE_LABELS: Record<DeploymentState, string> = {
  notDeployed: "not deployed",
  deploying: "deploying",
  running: "running",
  stopping: "turning off",
  stopped: "off",
  restarting: "restarting",
  erasing: "deleting data",
  runningCommand: "running a command",
  failed: "needs attention",
};

/** A short description of the audience, e.g. "n8n · deployment off or failed". */
export function audienceLabel(
  audience: BroadcastAudienceInDto,
  productName: string | null,
): string {
  if (audience.type === "all") return "All users";
  if (audience.type === "users") {
    const count = audience.userIds.length;
    return `${count} picked ${count === 1 ? "user" : "users"}`;
  }
  const name = productName ?? "Product";
  if (audience.match === "active") return `${name} · active`;
  const states = audience.states.map((state) => DEPLOYMENT_STATE_LABELS[state]);
  const list =
    states.length > 1
      ? `${states.slice(0, -1).join(", ")} or ${states[states.length - 1]}`
      : states[0];
  return `${name} · deployment ${list}`;
}

export class BroadcastError extends Error {}

function toOut(doc: HydratedDocument<BroadcastInterface>): BroadcastOutDto {
  return {
    id: doc._id.toString(),
    subject: doc.subject,
    body: doc.body,
    link: doc.link ?? null,
    buttonLabel: doc.buttonLabel ?? null,
    inApp: doc.inApp,
    audienceType: doc.audience.type,
    productMatch: doc.audience.match ?? null,
    audienceLabel: doc.audienceLabel,
    status: doc.status,
    recipientCount: doc.recipientCount,
    sentCount: doc.sentCount,
    failedCount: doc.failedCount,
    createdBy: doc.createdBy ? doc.createdBy.toString() : null,
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
    finishedAt: doc.finishedAt ? doc.finishedAt.toISOString() : null,
  };
}

function toStored(audience: BroadcastAudienceInDto): BroadcastAudience {
  return {
    type: audience.type,
    userIds:
      audience.type === "users"
        ? audience.userIds.map((id) => new Types.ObjectId(id))
        : [],
    productId:
      audience.type === "product" ? new Types.ObjectId(audience.productId) : null,
    match: audience.type === "product" ? audience.match : null,
    states:
      audience.type === "product" && audience.match === "deployment"
        ? audience.states
        : [],
  };
}

/** Admin email to many users: pick an audience, compose, send, keep a log. */
export class BroadcastService {
  /** Sends still running, so tests and shutdown can wait for them. */
  private readonly pending = new Set<Promise<void>>();

  /** The unblocked users the audience covers, sorted by email. */
  async resolve(
    audience: BroadcastAudienceInDto,
    now: Date = new Date(),
  ): Promise<{ recipients: BroadcastRecipientDto[]; label: string }> {
    let productName: string | null = null;
    const filter: Record<string, unknown> = { isBlocked: false };

    if (audience.type === "users") {
      filter._id = { $in: audience.userIds };
    } else if (audience.type === "product") {
      const product = await ProductModel.findById(audience.productId, {
        name: 1,
      }).exec();
      if (!product) throw new BroadcastError("Product not found");
      productName = product.name;

      let userIds: Types.ObjectId[];
      if (audience.match === "active") {
        const [subscribed, owned] = await Promise.all([
          UserProductPeriodModel.distinct("userId", {
            productId: audience.productId,
            startsAt: { $lte: now },
            $or: [{ endsAt: null }, { endsAt: { $gt: now } }],
          }).exec(),
          PurchaseModel.distinct("userId", {
            productId: audience.productId,
          }).exec(),
        ]);
        userIds = [...subscribed, ...owned];
      } else {
        userIds = await DeploymentModel.distinct("userId", {
          productId: audience.productId,
          state: { $in: audience.states },
        }).exec();
      }
      filter._id = { $in: userIds };
    }

    const users = await UserModel.find(filter, { email: 1 })
      .sort({ email: 1 })
      .lean()
      .exec();
    return {
      recipients: users.map((user) => ({
        id: user._id.toString(),
        email: user.email,
      })),
      label: audienceLabel(audience, productName),
    };
  }

  async preview(
    audience: BroadcastAudienceInDto,
  ): Promise<BroadcastAudiencePreviewOutDto> {
    const { recipients, label } = await this.resolve(audience);
    return {
      count: recipients.length,
      label,
      sample: recipients.slice(0, SAMPLE_SIZE),
    };
  }

  /** Logs the email, then sends it in the background; returns at once. */
  async send(
    input: SendBroadcastInDto,
    adminId: string,
  ): Promise<BroadcastOutDto> {
    const { recipients, label } = await this.resolve(input.audience);
    if (recipients.length === 0) {
      throw new BroadcastError("No one matches this audience");
    }
    if (recipients.length > MAX_BROADCAST_RECIPIENTS) {
      throw new BroadcastError(
        `At most ${MAX_BROADCAST_RECIPIENTS} recipients per email; narrow the audience`,
      );
    }

    const doc = await BroadcastModel.create({
      subject: input.subject,
      body: input.body,
      link: input.link,
      buttonLabel: input.buttonLabel,
      inApp: input.inApp,
      audience: toStored(input.audience),
      audienceLabel: label,
      status: "sending",
      recipientCount: recipients.length,
      sentCount: 0,
      failedCount: 0,
      createdBy: new Types.ObjectId(adminId),
      finishedAt: null,
    });

    const job = this.deliver(doc._id, input, recipients)
      .catch((error: unknown) => {
        logger.error(
          `Broadcast ${doc._id.toString()} stopped: ${error instanceof Error ? error.message : String(error)}`,
          SOURCE,
          "send",
        );
      })
      .finally(() => this.pending.delete(job));
    this.pending.add(job);

    return toOut(doc);
  }

  /** One email at a time, so the SMTP server is not flooded. */
  private async deliver(
    id: Types.ObjectId,
    input: SendBroadcastInDto,
    recipients: BroadcastRecipientDto[],
  ): Promise<void> {
    if (input.inApp) {
      for (let i = 0; i < recipients.length; i += IN_APP_BATCH) {
        try {
          await notificationService.send({
            userIds: recipients.slice(i, i + IN_APP_BATCH).map((r) => r.id),
            title: input.subject,
            body: input.body,
            link: input.link,
            channels: "in_app",
          });
        } catch (error) {
          logger.error(
            `In-app copy of broadcast ${id.toString()} failed: ${error instanceof Error ? error.message : String(error)}`,
            SOURCE,
            "deliver",
          );
        }
      }
    }

    const url = absoluteLink(env.appBaseUrl, input.link);
    let sent = 0;
    let failed = 0;
    for (const [index, recipient] of recipients.entries()) {
      const ok = await mailer.sendNotification(recipient.email, {
        title: input.subject,
        body: input.body,
        url,
        buttonLabel: input.buttonLabel ?? undefined,
      });
      if (ok) sent += 1;
      else failed += 1;
      if ((index + 1) % PROGRESS_EVERY === 0) {
        await BroadcastModel.updateOne(
          { _id: id },
          { $set: { sentCount: sent, failedCount: failed } },
        );
      }
    }

    await BroadcastModel.updateOne(
      { _id: id },
      {
        $set: {
          sentCount: sent,
          failedCount: failed,
          status: "sent",
          finishedAt: new Date(),
        },
      },
    );
    logger.info(
      `Broadcast ${id.toString()} sent: ${sent} delivered, ${failed} failed`,
      SOURCE,
      "deliver",
    );
  }

  async list(page: number, pageSize: number): Promise<BroadcastListOutDto> {
    const [docs, total] = await Promise.all([
      BroadcastModel.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec(),
      BroadcastModel.countDocuments(),
    ]);
    return { items: docs.map(toOut), page, pageSize, total };
  }

  /** Resolves once every send started so far has finished. */
  async idle(): Promise<void> {
    while (this.pending.size > 0) {
      await Promise.all([...this.pending]);
    }
  }
}

export const broadcastService = new BroadcastService();
