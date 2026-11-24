import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import { ProductModel } from "../../models/product/product.model";
import { UserProductPeriodModel } from "../../models/userProductPeriod/userProductPeriod.model";
import {
  daysLeft,
  reminderText,
  remindExpiring,
  type ReminderDeps,
} from "./expiryReminder";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-23T03:00:00Z");
let mongo: MongoMemoryServer;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "expiry-reminder-test" });
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

afterEach(async () => {
  await UserProductPeriodModel.deleteMany({});
  await ProductModel.deleteMany({});
});

function recorder(renews: (productId: string) => boolean = () => false) {
  const sent: { userId: string; productId: string; title: string }[] = [];
  const deps: ReminderDeps = {
    renewsAutomatically: async (_userId, productId) => renews(productId),
    notify: async (userId, productId, { title }) => {
      sent.push({ userId, productId, title });
    },
  };
  return { sent, deps };
}

async function product(name: string, deletedAt: Date | null = null) {
  const doc = await ProductModel.create({
    name,
    kind: "subscription",
    color: "#000000",
    priceIdr: 20_000,
    durationDays: 35,
    showOnPricingPage: true,
    deletedAt,
  });
  return doc._id;
}

async function period(
  userId: Types.ObjectId,
  productId: Types.ObjectId,
  startsAt: Date,
  endsAt: Date,
) {
  return UserProductPeriodModel.create({
    userId,
    productId,
    startsAt,
    endsAt,
    source: "checkout",
  });
}

describe("expiry reminder text", () => {
  it("rounds days left up, with at least one", () => {
    assert.equal(daysLeft(new Date(NOW.getTime() + 4.2 * DAY), NOW), 5);
    assert.equal(daysLeft(new Date(NOW.getTime() + 60_000), NOW), 1);
  });

  it("names the product, the days left and the date", () => {
    const text = reminderText("n8n hosting", new Date("2026-11-28T03:00:00Z"), NOW);
    assert.equal(text.title, "n8n hosting ends in 5 days");
    assert.match(text.body, /28 November 2026/);
    const one = reminderText("n8n hosting", new Date(NOW.getTime() + DAY), NOW);
    assert.equal(one.title, "n8n hosting ends in 1 day");
  });
});

describe("expiry reminder sweep", () => {
  it("reminds once for a subscription ending within five days", async () => {
    const user = new Types.ObjectId();
    const productId = await product("n8n hosting");
    await period(user, productId, new Date(NOW.getTime() - 30 * DAY), new Date(NOW.getTime() + 4 * DAY));
    const { sent, deps } = recorder();

    assert.equal(await remindExpiring(NOW, deps), 1);
    assert.deepEqual(sent, [
      { userId: user.toString(), productId: productId.toString(), title: "n8n hosting ends in 4 days" },
    ]);
    // A later sweep does not remind again.
    assert.equal(await remindExpiring(new Date(NOW.getTime() + DAY), deps), 0);
    assert.equal(sent.length, 1);
  });

  it("waits until the last five days", async () => {
    const productId = await product("Plane");
    await period(new Types.ObjectId(), productId, NOW, new Date(NOW.getTime() + 6 * DAY));
    const { sent, deps } = recorder();
    assert.equal(await remindExpiring(NOW, deps), 0);
    assert.equal(sent.length, 0);
  });

  it("skips a period another one continues, and reminds for that one later", async () => {
    const user = new Types.ObjectId();
    const productId = await product("Odoo");
    const end = new Date(NOW.getTime() + 3 * DAY);
    await period(user, productId, new Date(NOW.getTime() - 30 * DAY), end);
    await period(user, productId, end, new Date(end.getTime() + 35 * DAY));
    const { sent, deps } = recorder();
    assert.equal(await remindExpiring(NOW, deps), 0);

    const later = new Date(end.getTime() + 31 * DAY);
    assert.equal(await remindExpiring(later, deps), 1);
    assert.equal(sent.length, 1);
  });

  it("tells what Paddle renews, and skips products that are gone", async () => {
    const renewing = await product("Vaultwarden");
    const gone = await product("Old thing", new Date());
    const end = new Date(NOW.getTime() + 2 * DAY);
    await period(new Types.ObjectId(), renewing, NOW, end);
    await period(new Types.ObjectId(), gone, NOW, end);
    const { sent, deps } = recorder((id) => id === renewing.toString());
    assert.equal(await remindExpiring(NOW, deps), 1);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].productId, renewing.toString());
  });

  it("tries again next sweep when sending fails", async () => {
    const productId = await product("Snipe-IT");
    await period(new Types.ObjectId(), productId, NOW, new Date(NOW.getTime() + DAY));
    let fail = true;
    const sent: string[] = [];
    const deps: ReminderDeps = {
      renewsAutomatically: async () => false,
      notify: async (_u, _p, { title }) => {
        if (fail) throw new Error("smtp down");
        sent.push(title);
      },
    };
    assert.equal(await remindExpiring(NOW, deps), 0);
    fail = false;
    assert.equal(await remindExpiring(NOW, deps), 1);
    assert.deepEqual(sent, ["Snipe-IT ends in 1 day"]);
  });
});
