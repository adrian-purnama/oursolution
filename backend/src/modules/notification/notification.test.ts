import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, afterEach, before, describe, it, mock } from "node:test";
import express from "express";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import type { NotificationOutDto } from "../../dto/notification.dto";
import { NotificationModel } from "../../models/notification/notification.model";
import { UserModel } from "../../models/user/user.model";
import { signAccessToken } from "../../utils/jwt";
import {
  MAX_RECIPIENTS,
  NotificationInputError,
} from "../../validation/notification";
import { mailer } from "../mail/mail.service";
import notificationRoutes from "./notification.route";
import { notificationService } from "./notification.service";
import { NotificationStreamHub, type SseClient } from "./notification.stream";

let mongo: MongoMemoryServer;
let server: Server;
let base = "";

type TestUser = { id: string; email: string; token: string };
let alice: TestUser;
let bob: TestUser;

async function makeUser(email: string): Promise<TestUser> {
  const user = await UserModel.create({ email, hashedPassword: "x" });
  return {
    id: user.id as string,
    email,
    token: signAccessToken({ userId: user.id, email, rememberMe: false }),
  };
}

async function api<T>(
  user: TestUser | null,
  method: string,
  path: string,
): Promise<{ status: number; body: { success: boolean; data: T } }> {
  const res = await fetch(`${base}/notifications${path}`, {
    method,
    headers: user ? { Authorization: `Bearer ${user.token}` } : {},
  });
  return { status: res.status, body: (await res.json()) as never };
}

type SseEvent = { id: string; event: string; data: string };

/** A fetch-based SSE reader, like the frontend's. */
async function openStream(user: TestUser, lastEventId?: string) {
  const controller = new AbortController();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${user.token}`,
  };
  if (lastEventId) headers["Last-Event-ID"] = lastEventId;
  const res = await fetch(`${base}/notifications/stream`, {
    headers,
    signal: controller.signal,
  });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function parse(block: string): SseEvent | null {
    const event: SseEvent = { id: "", event: "message", data: "" };
    let hasData = false;
    for (const line of block.split("\n")) {
      if (line.startsWith(":")) continue;
      const [field, ...rest] = line.split(":");
      const value = rest.join(":").replace(/^ /, "");
      if (field === "id") event.id = value;
      if (field === "event") event.event = value;
      if (field === "data") {
        event.data += value;
        hasData = true;
      }
    }
    return hasData ? event : null;
  }

  async function next(timeoutMs = 3000): Promise<SseEvent> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const end = buffer.indexOf("\n\n");
      if (end >= 0) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const event = parse(block);
        if (event) return event;
        continue;
      }
      let timer: NodeJS.Timeout | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("No SSE event in time")),
          Math.max(0, deadline - Date.now()),
        );
      });
      try {
        const chunk = await Promise.race([reader.read(), timeout]);
        if (chunk.done) throw new Error("Stream ended");
        buffer += decoder.decode(chunk.value, { stream: true });
      } finally {
        clearTimeout(timer);
      }
    }
  }

  return {
    res,
    next,
    close: () => controller.abort(),
  };
}

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "notifications-test" });
  await NotificationModel.init();
  const app = express();
  app.use(express.json());
  app.use("/notifications", notificationRoutes);
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  alice = await makeUser("alice@example.com");
  bob = await makeUser("bob@example.com");
});

after(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await mongoose.disconnect();
  await mongo.stop();
});

afterEach(async () => {
  mock.restoreAll();
  await notificationService.idle();
  await NotificationModel.deleteMany({});
});

function mockMailer(impl: () => Promise<boolean> = async () => true) {
  return mock.method(mailer, "sendNotification", impl);
}

describe("notificationService.send", () => {
  it("in_app persists and reaches an open SSE stream", async () => {
    const mail = mockMailer();
    const stream = await openStream(alice);
    assert.equal(stream.res.status, 200);
    assert.match(
      stream.res.headers.get("content-type") ?? "",
      /^text\/event-stream/,
    );
    assert.equal(stream.res.headers.get("x-accel-buffering"), "no");

    const [result] = await notificationService.send({
      userId: alice.id,
      title: "Ticket updated",
      body: "An admin replied.",
      link: "/support/abc",
      channels: "in_app",
    });

    assert.equal(result.inApp.status, "stored");
    assert.equal(result.email.status, "skipped");
    const stored = await NotificationModel.find({ userId: alice.id }).lean();
    assert.equal(stored.length, 1);
    assert.equal(stored[0].channels, "in_app");

    const event = await stream.next();
    assert.equal(event.event, "notification");
    assert.equal(event.id, stored[0]._id.toString());
    const dto = JSON.parse(event.data) as NotificationOutDto;
    assert.equal(dto.title, "Ticket updated");
    assert.equal(dto.link, "/support/abc");
    assert.equal(dto.readAt, null);
    if (result.inApp.status === "stored") {
      assert.equal(result.inApp.liveConnections, 1);
    }
    stream.close();
    await notificationService.idle();
    assert.equal(mail.mock.callCount(), 0);
  });

  it("email calls the mailer with an absolute link and stores nothing", async () => {
    const mail = mockMailer();
    const [result] = await notificationService.send({
      userId: alice.id,
      title: "Invoice ready",
      body: "Please pay soon.",
      link: "/dashboard?tab=billing",
      channels: "email",
    });
    assert.deepEqual(result.email, { status: "queued" });
    assert.equal(result.inApp.status, "skipped");
    await notificationService.idle();

    assert.equal(mail.mock.callCount(), 1);
    const [to, payload] = mail.mock.calls[0].arguments as [
      string,
      { title: string; url: string | null },
    ];
    assert.equal(to, alice.email);
    assert.equal(payload.title, "Invoice ready");
    assert.match(
      payload.url ?? "",
      /^https?:\/\/[^/]+\/dashboard\?tab=billing$/,
    );
    assert.equal(await NotificationModel.countDocuments(), 0);
  });

  it("both: in-app still succeeds when the email fails", async () => {
    const mail = mockMailer(async () => {
      throw new Error("SMTP down");
    });
    const results = await notificationService.send({
      userIds: [alice.id, bob.id],
      title: "Maintenance",
      body: "Tonight at 22:00.",
      channels: "both",
    });
    await notificationService.idle();

    assert.equal(results.length, 2);
    for (const r of results) {
      assert.equal(r.inApp.status, "stored");
      assert.equal(r.email.status, "queued");
    }
    assert.equal(mail.mock.callCount(), 2);
    assert.equal(await NotificationModel.countDocuments(), 2);
  });

  it("both: a mailer that reports failure does not throw either", async () => {
    mockMailer(async () => false);
    const [result] = await notificationService.send({
      userId: alice.id,
      title: "Hi",
      body: "There",
      channels: "both",
    });
    await notificationService.idle();
    assert.equal(result.inApp.status, "stored");
  });

  it("customEmail replaces the generic email template", async () => {
    const generic = mockMailer();
    const sentTo: string[] = [];
    const [result] = await notificationService.send(
      {
        userId: alice.id,
        title: "Invoice ready",
        body: "Rp 10.000 due.",
        link: "/billing/abc",
        channels: "both",
      },
      {
        customEmail: async (to) => {
          sentTo.push(to);
          return true;
        },
      },
    );
    await notificationService.idle();
    assert.equal(result.inApp.status, "stored");
    assert.deepEqual(sentTo, [alice.email]);
    assert.equal(generic.mock.callCount(), 0);
  });

  it("reports unknown users per recipient instead of throwing", async () => {
    mockMailer();
    const ghost = new mongoose.Types.ObjectId().toString();
    const results = await notificationService.send({
      userIds: [alice.id, ghost],
      title: "Hi",
      body: "There",
      channels: "both",
    });
    const byId = new Map(results.map((r) => [r.userId, r]));
    assert.equal(byId.get(alice.id)?.inApp.status, "stored");
    assert.equal(byId.get(ghost)?.inApp.status, "skipped");
    assert.equal(byId.get(ghost)?.email.status, "skipped");
  });

  for (const link of [
    "https://evil.example.com/x",
    "http://evil.example.com",
    "//evil.example.com",
    "/\\evil.example.com",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "relative/path",
    "/has space",
    "/tab\there",
    `/${"a".repeat(300)}`,
  ]) {
    it(`rejects the link ${JSON.stringify(link.slice(0, 40))}`, async () => {
      await assert.rejects(
        notificationService.send({
          userId: alice.id,
          title: "Hi",
          body: "There",
          link,
          channels: "in_app",
        }),
        NotificationInputError,
      );
      assert.equal(await NotificationModel.countDocuments(), 0);
    });
  }

  it("rejects bad titles, bodies, channels and recipient lists", async () => {
    const valid = {
      userId: alice.id,
      title: "Hi",
      body: "There",
      channels: "in_app",
    };
    const bad: Record<string, unknown>[] = [
      { ...valid, title: "   " },
      { ...valid, title: "x".repeat(101) },
      { ...valid, body: "" },
      { ...valid, body: "x".repeat(501) },
      { ...valid, channels: "sms" },
      { ...valid, userId: "not-an-id" },
      { ...valid, userId: undefined },
      { ...valid, userIds: [alice.id] },
      {
        ...valid,
        userId: undefined,
        userIds: Array.from({ length: MAX_RECIPIENTS + 1 }, () =>
          new mongoose.Types.ObjectId().toString(),
        ),
      },
    ];
    for (const input of bad) {
      await assert.rejects(
        notificationService.send(input),
        NotificationInputError,
      );
    }
  });

  it("strips control characters and null bytes and trims", async () => {
    await notificationService.send({
      userId: alice.id,
      title: "  Hello\u0000\u0007   world‮ ",
      body: "\u0000 Line one\r\nLine two\u001B ",
      channels: "in_app",
    });
    const doc = await NotificationModel.findOne({ userId: alice.id }).lean();
    assert.equal(doc?.title, "Hello world");
    assert.equal(doc?.body, "Line one\nLine two");
  });
});

describe("HTML in notifications stays inert", () => {
  const html = `<script>alert("x")</script><img src=x onerror=alert(1)>`;

  it("is stored and returned as literal text", async () => {
    await notificationService.send({
      userId: alice.id,
      title: html.slice(0, 100),
      body: html,
      channels: "in_app",
    });
    const { body } = await api<{ items: NotificationOutDto[] }>(
      alice,
      "GET",
      "/",
    );
    assert.equal(body.data.items[0].body, html);
  });

  it("is escaped in the email", async () => {
    let sentHtml = "";
    let subject = "";
    const transporter = (
      mailer as unknown as {
        transporter: {
          sendMail: (o: { html: string; subject: string }) => Promise<unknown>;
        };
      }
    ).transporter;
    mock.method(
      transporter,
      "sendMail",
      async (o: { html: string; subject: string }) => {
        sentHtml = o.html;
        subject = o.subject;
        return {};
      },
    );
    await notificationService.send({
      userId: alice.id,
      title: `<b>Hi</b> "there"`,
      body: html,
      link: "/a?x=<y>&z=1",
      channels: "email",
    });
    await notificationService.idle();

    assert.equal(subject, `<b>Hi</b> "there"`);
    assert.ok(!sentHtml.includes("<script>"));
    assert.ok(!sentHtml.includes("<img"));
    assert.ok(!sentHtml.includes("<b>Hi"));
    assert.ok(
      sentHtml.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"),
    );
    assert.ok(sentHtml.includes("/a?x=&lt;y&gt;&amp;z=1"));
  });
});

describe("notifications API", () => {
  async function seed(user: TestUser, count: number): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const [r] = await notificationService.send({
        userId: user.id,
        title: `N${i}`,
        body: "Body",
        channels: "in_app",
      });
      if (r.inApp.status === "stored") ids.push(r.inApp.notificationId);
    }
    return ids;
  }

  it("requires a signed-in user", async () => {
    assert.equal((await api(null, "GET", "/")).status, 401);
    assert.equal((await api(null, "GET", "/unread-count")).status, 401);
    assert.equal((await api(null, "POST", "/read-all")).status, 401);
    const res = await fetch(`${base}/notifications/stream`);
    assert.equal(res.status, 401);
  });

  it("marks one read (idempotently), counts unread, marks all read", async () => {
    const [first] = await seed(alice, 3);
    await seed(bob, 2);

    let count = await api<{ count: number }>(alice, "GET", "/unread-count");
    assert.equal(count.body.data.count, 3);

    const read = await api<NotificationOutDto>(
      alice,
      "PATCH",
      `/${first}/read`,
    );
    assert.equal(read.status, 200);
    assert.ok(read.body.data.readAt);
    const again = await api<NotificationOutDto>(
      alice,
      "PATCH",
      `/${first}/read`,
    );
    assert.equal(again.status, 200);
    assert.equal(again.body.data.readAt, read.body.data.readAt);

    count = await api<{ count: number }>(alice, "GET", "/unread-count");
    assert.equal(count.body.data.count, 2);

    const all = await api<{ updated: number }>(alice, "POST", "/read-all");
    assert.equal(all.body.data.updated, 2);
    count = await api<{ count: number }>(alice, "GET", "/unread-count");
    assert.equal(count.body.data.count, 0);

    // Bob's are untouched.
    count = await api<{ count: number }>(bob, "GET", "/unread-count");
    assert.equal(count.body.data.count, 2);
  });

  it("returns 404 for another user's notification", async () => {
    const [bobs] = await seed(bob, 1);
    const res = await api(alice, "PATCH", `/${bobs}/read`);
    assert.equal(res.status, 404);
    const missing = new mongoose.Types.ObjectId().toString();
    assert.equal((await api(alice, "PATCH", `/${missing}/read`)).status, 404);

    const doc = await NotificationModel.findById(bobs).lean();
    assert.equal(doc?.readAt, null);
    const list = await api<{ items: NotificationOutDto[] }>(alice, "GET", "/");
    assert.equal(list.body.data.items.length, 0);
    // Bob's id is not a valid cursor for Alice either.
    assert.equal((await api(alice, "GET", `/?cursor=${bobs}`)).status, 400);
  });

  it("lists newest first with a cursor and caps the limit", async () => {
    await seed(alice, 5);
    const first = await api<{
      items: NotificationOutDto[];
      nextCursor: string;
    }>(alice, "GET", "/?limit=2");
    assert.deepEqual(
      first.body.data.items.map((n) => n.title),
      ["N4", "N3"],
    );
    const second = await api<{
      items: NotificationOutDto[];
      nextCursor: string | null;
    }>(alice, "GET", `/?limit=2&cursor=${first.body.data.nextCursor}`);
    assert.deepEqual(
      second.body.data.items.map((n) => n.title),
      ["N2", "N1"],
    );
    const third = await api<{
      items: NotificationOutDto[];
      nextCursor: string | null;
    }>(alice, "GET", `/?limit=2&cursor=${second.body.data.nextCursor}`);
    assert.deepEqual(
      third.body.data.items.map((n) => n.title),
      ["N0"],
    );
    assert.equal(third.body.data.nextCursor, null);

    assert.equal((await api(alice, "GET", "/?limit=51")).status, 400);
    assert.equal((await api(alice, "GET", "/?limit=0")).status, 400);
  });
});

describe("notification stream", () => {
  it("replays what was missed after Last-Event-ID", async () => {
    const first = await openStream(alice);
    await notificationService.send({
      userId: alice.id,
      title: "One",
      body: "1",
      channels: "in_app",
    });
    const seen = await first.next();
    first.close();

    // Created while disconnected, plus one for Bob that must not leak.
    for (const title of ["Two", "Three"]) {
      await notificationService.send({
        userId: alice.id,
        title,
        body: "x",
        channels: "in_app",
      });
    }
    await notificationService.send({
      userId: bob.id,
      title: "Bob only",
      body: "x",
      channels: "in_app",
    });

    const second = await openStream(alice, seen.id);
    const a = await second.next();
    const b = await second.next();
    assert.deepEqual(
      [a, b].map((e) => (JSON.parse(e.data) as NotificationOutDto).title),
      ["Two", "Three"],
    );

    // Live delivery continues after the replay.
    await notificationService.send({
      userId: alice.id,
      title: "Four",
      body: "x",
      channels: "in_app",
    });
    const c = await second.next();
    assert.equal((JSON.parse(c.data) as NotificationOutDto).title, "Four");
    second.close();
  });

  it("does not deliver to other users' streams", async () => {
    const bobStream = await openStream(bob);
    await notificationService.send({
      userId: alice.id,
      title: "Private",
      body: "x",
      channels: "in_app",
    });
    await assert.rejects(bobStream.next(300), /No SSE event in time/);
    bobStream.close();
  });
});

describe("NotificationStreamHub", () => {
  function fakeClient() {
    const client = {
      chunks: [] as string[],
      ended: false,
      write(chunk: string) {
        client.chunks.push(chunk);
        return true;
      },
      end() {
        client.ended = true;
      },
    };
    return client satisfies SseClient;
  }

  it("keeps several streams per user and closes the oldest past the cap", () => {
    const hub = new NotificationStreamHub(2);
    const [a, b, c] = [fakeClient(), fakeClient(), fakeClient()];
    hub.add("u1", a);
    hub.add("u1", b);
    const removeC = hub.add("u1", c);
    assert.equal(a.ended, true);
    assert.equal(hub.count("u1"), 2);

    const sent = hub.publish("u1", {
      id: "n1",
      title: "t",
      body: "b",
      link: null,
      readAt: null,
      createdAt: new Date().toISOString(),
    });
    assert.equal(sent, 2);
    assert.equal(a.chunks.length, 0);
    assert.match(
      b.chunks[0],
      /^id: n1\nevent: notification\ndata: \{.*\}\n\n$/,
    );

    removeC();
    assert.equal(hub.count("u1"), 1);
  });
});
