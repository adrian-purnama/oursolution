import assert from "node:assert/strict";
import { after, afterEach, before, describe, it, mock } from "node:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import { BroadcastModel } from "../../models/broadcast/broadcast.model";
import { DeploymentModel } from "../../models/deployment/deployment.model";
import { ProductModel } from "../../models/product/product.model";
import { PurchaseModel } from "../../models/purchase/purchase.model";
import { UserModel } from "../../models/user/user.model";
import { UserProductPeriodModel } from "../../models/userProductPeriod/userProductPeriod.model";
import {
  parseBroadcastAudience,
  parseSendBroadcastInDto,
} from "../../validation/broadcast";
import { mailer } from "../mail/mail.service";
import { audienceLabel, broadcastService } from "./broadcast.service";

let mongo: MongoMemoryServer;
const now = new Date();
const day = 24 * 60 * 60 * 1000;

async function user(email: string, isBlocked = false): Promise<Types.ObjectId> {
  const doc = await UserModel.create({ email, hashedPassword: "x", isBlocked });
  return doc._id;
}

async function product(name: string): Promise<Types.ObjectId> {
  const { insertedId } = await ProductModel.collection.insertOne({ name });
  return insertedId;
}

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

afterEach(async () => {
  mock.restoreAll();
  await mongoose.connection.db!.dropDatabase();
});

describe("parseSendBroadcastInDto", () => {
  const audience = { type: "all" };

  it("cleans the subject and keeps paragraphs", () => {
    const parsed = parseSendBroadcastInDto({
      subject: "  Upgrade \n soon ",
      body: "Line one\r\n\r\n\r\nLine two",
      audience,
    });
    assert.equal(parsed.subject, "Upgrade soon");
    assert.equal(parsed.body, "Line one\n\nLine two");
    assert.equal(parsed.inApp, false);
  });

  it("drops the button label without a link", () => {
    const parsed = parseSendBroadcastInDto({
      subject: "Hi",
      body: "Body",
      buttonLabel: "Open",
      audience,
    });
    assert.equal(parsed.buttonLabel, null);
  });

  it("refuses an external link", () => {
    assert.throws(() =>
      parseSendBroadcastInDto({
        subject: "Hi",
        body: "Body",
        link: "https://evil.example",
        audience,
      }),
    );
  });

  it("holds an in-app copy to the notification limits", () => {
    assert.throws(
      () =>
        parseSendBroadcastInDto({
          subject: "Hi",
          body: "x".repeat(501),
          inApp: true,
          audience,
        }),
      /in-app/,
    );
  });

  it("needs deployment states for a deployment audience", () => {
    assert.throws(() =>
      parseBroadcastAudience({
        type: "product",
        productId: new Types.ObjectId().toString(),
        match: "deployment",
        states: [],
      }),
    );
    assert.throws(() =>
      parseBroadcastAudience({
        type: "product",
        productId: new Types.ObjectId().toString(),
        match: "deployment",
        states: ["sleeping"],
      }),
    );
  });
});

describe("audienceLabel", () => {
  it("lists the deployment states", () => {
    assert.equal(
      audienceLabel(
        {
          type: "product",
          productId: "x",
          match: "deployment",
          states: ["stopped", "failed"],
        },
        "n8n",
      ),
      "n8n · deployment off or needs attention",
    );
  });
});

describe("broadcastService.resolve", () => {
  it("finds active users of a product, skipping blocked and ended ones", async () => {
    const n8n = await product("n8n");
    const subscriber = await user("sub@example.com");
    const owner = await user("owner@example.com");
    const ended = await user("ended@example.com");
    const blocked = await user("blocked@example.com", true);
    await UserProductPeriodModel.collection.insertMany([
      { userId: subscriber, productId: n8n, startsAt: new Date(now.getTime() - day), endsAt: null },
      { userId: blocked, productId: n8n, startsAt: new Date(now.getTime() - day), endsAt: null },
      {
        userId: ended,
        productId: n8n,
        startsAt: new Date(now.getTime() - 3 * day),
        endsAt: new Date(now.getTime() - day),
      },
    ]);
    await PurchaseModel.collection.insertOne({ userId: owner, productId: n8n });

    const { recipients, label } = await broadcastService.resolve({
      type: "product",
      productId: n8n.toString(),
      match: "active",
    });
    assert.deepEqual(
      recipients.map((r) => r.email),
      ["owner@example.com", "sub@example.com"],
    );
    assert.equal(label, "n8n · active");
  });

  it("filters by deployment state", async () => {
    const n8n = await product("n8n");
    const off = await user("off@example.com");
    const running = await user("running@example.com");
    await DeploymentModel.collection.insertMany([
      { userId: off, productId: n8n, state: "stopped" },
      { userId: running, productId: n8n, state: "running" },
    ]);

    const { recipients } = await broadcastService.resolve({
      type: "product",
      productId: n8n.toString(),
      match: "deployment",
      states: ["running"],
    });
    assert.deepEqual(recipients.map((r) => r.email), ["running@example.com"]);
  });
});

describe("broadcastService.send", () => {
  it("emails every recipient and logs the counts", async () => {
    const admin = await user("admin@example.com");
    const a = await user("a@example.com");
    const b = await user("b@example.com");
    const sent: string[] = [];
    mock.method(mailer, "sendNotification", async (to: string) => {
      sent.push(to);
      return to !== "b@example.com";
    });

    const out = await broadcastService.send(
      parseSendBroadcastInDto({
        subject: "Maintenance",
        body: "We upgrade tonight.",
        audience: { type: "users", userIds: [a.toString(), b.toString()] },
      }),
      admin.toString(),
    );
    assert.equal(out.status, "sending");
    assert.equal(out.recipientCount, 2);
    await broadcastService.idle();

    assert.deepEqual(sent.sort(), ["a@example.com", "b@example.com"]);
    const doc = await BroadcastModel.findById(out.id).lean();
    assert.equal(doc?.status, "sent");
    assert.equal(doc?.sentCount, 1);
    assert.equal(doc?.failedCount, 1);
  });

  it("refuses an empty audience", async () => {
    const admin = await user("admin@example.com");
    const n8n = await product("n8n");
    await assert.rejects(
      broadcastService.send(
        parseSendBroadcastInDto({
          subject: "Hi",
          body: "Body",
          audience: { type: "product", productId: n8n.toString(), match: "active" },
        }),
        admin.toString(),
      ),
      /No one matches/,
    );
  });
});
