import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import sharp from "sharp";
import { env } from "../../environment/env";
import { TicketModel } from "../../models/ticket/ticket.model";
import { TicketMessageModel } from "../../models/ticketMessage/ticketMessage.model";
import { UserModel } from "../../models/user/user.model";
import { signLink, SIGNED_LINK_TTL_SECONDS } from "../../utils/signedLink";
import { cleanBody, cleanSubject } from "../../validation/ticket";
import {
  MAX_FOLLOWUPS,
  TICKET_ERROR_CODES,
  TicketError,
  TicketService,
} from "./ticket.service";

let server: MongoMemoryServer;
let service: TicketService;

before(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri(), { dbName: "tickets-test" });
  await Promise.all([TicketModel.init(), TicketMessageModel.init()]);
});

after(async () => {
  await mongoose.disconnect();
  await server.stop();
});

beforeEach(async () => {
  mock.restoreAll();
  service = new TicketService();
  const db = mongoose.connection.db!;
  for (const collection of await db.collections()) {
    await collection.deleteMany({});
  }
});

let emails = 0;
async function makeUser(role: "user" | "admin" = "user"): Promise<string> {
  emails += 1;
  const user = await UserModel.create({
    email: `person${emails}@example.com`,
    hashedPassword: "x",
    isBlocked: false,
    role,
  });
  return String(user._id);
}

async function png(width = 20, height = 20): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: "#cc3300" },
  })
    .png()
    .toBuffer();
}

async function storedFiles(): Promise<number> {
  return mongoose.connection
    .db!.collection("ticketAttachments.files")
    .countDocuments();
}

/** Asserts `promise` is refused with `code`. */
async function refused(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof TicketError, String(error));
    assert.equal(error.code, code);
    return true;
  });
}

async function openTicket(userId: string): Promise<string> {
  const ticket = await service.create(
    userId,
    { subject: "Cannot log in", description: "It says wrong password" },
    null,
  );
  return ticket.id;
}

describe("follow-up limit", () => {
  it("allows 3 follow-ups, then refuses the 4th", async () => {
    const user = await makeUser();
    const ticketId = await openTicket(user);
    for (let sent = 1; sent <= MAX_FOLLOWUPS; sent++) {
      const out = await service.addUserMessage(user, ticketId, `more ${sent}`, null);
      assert.equal(out.followupsRemaining, MAX_FOLLOWUPS - sent);
    }
    await refused(
      service.addUserMessage(user, ticketId, "one more", null),
      TICKET_ERROR_CODES.followupLimit,
    );
    const out = await service.getOwn(user, ticketId);
    assert.equal(out.canSend, false);
    assert.equal(out.messages.length, 1 + MAX_FOLLOWUPS);
  });

  it("gives 3 more after an admin reply and moves an open ticket on", async () => {
    const [user, admin] = [await makeUser(), await makeUser("admin")];
    const ticketId = await openTicket(user);
    for (let sent = 0; sent < MAX_FOLLOWUPS; sent++) {
      await service.addUserMessage(user, ticketId, "waiting", null);
    }
    const replied = await service.addAdminMessage(admin, ticketId, "On it", null);
    assert.equal(replied.followupCount, 0);
    assert.equal(replied.status, "in_progress");
    assert.ok(replied.lastAdminReplyAt);
    const moved = replied.messages.find((entry) => entry.kind === "status");
    assert.equal(moved?.fromStatus, "open");
    assert.equal(moved?.toStatus, "in_progress");

    for (let sent = 0; sent < MAX_FOLLOWUPS; sent++) {
      await service.addUserMessage(user, ticketId, "again", null);
    }
    await refused(
      service.addUserMessage(user, ticketId, "too many", null),
      TICKET_ERROR_CODES.followupLimit,
    );
  });

  it("lets exactly the free slots through when sent at the same time", async () => {
    const user = await makeUser();
    const ticketId = await openTicket(user);
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, index) =>
        service.addUserMessage(user, ticketId, `burst ${index}`, null),
      ),
    );
    const sent = results.filter((result) => result.status === "fulfilled");
    assert.equal(sent.length, MAX_FOLLOWUPS);
    for (const result of results) {
      if (result.status === "rejected") {
        assert.equal(
          (result.reason as TicketError).code,
          TICKET_ERROR_CODES.followupLimit,
        );
      }
    }
    const ticket = await TicketModel.findById(ticketId).orFail();
    assert.equal(ticket.followupCount, MAX_FOLLOWUPS);
    assert.equal(
      await TicketMessageModel.countDocuments({ ticketId, kind: "message" }),
      1 + MAX_FOLLOWUPS,
    );
  });
});

describe("closed tickets", () => {
  it("refuses customer messages until an admin reopens it", async () => {
    const [user, admin] = [await makeUser(), await makeUser("admin")];
    const ticketId = await openTicket(user);
    const closed = await service.setStatus(admin, ticketId, "closed");
    assert.equal(closed.canSend, false);
    await refused(
      service.addUserMessage(user, ticketId, "hello?", null),
      TICKET_ERROR_CODES.closed,
    );
    // An admin reply leaves it closed.
    const replied = await service.addAdminMessage(admin, ticketId, "Done", null);
    assert.equal(replied.status, "closed");

    await service.setStatus(admin, ticketId, "open");
    const out = await service.addUserMessage(user, ticketId, "thanks", null);
    assert.equal(out.status, "open");
    const changes = out.messages.filter((entry) => entry.kind === "status");
    assert.deepEqual(
      changes.map((entry) => [entry.fromStatus, entry.toStatus]),
      [
        ["open", "closed"],
        ["closed", "open"],
      ],
    );
  });

  it("records nothing when the status stays the same", async () => {
    const [user, admin] = [await makeUser(), await makeUser("admin")];
    const ticketId = await openTicket(user);
    const out = await service.setStatus(admin, ticketId, "open");
    assert.equal(out.messages.filter((entry) => entry.kind === "status").length, 0);
  });
});

describe("ownership", () => {
  it("hides another customer's ticket as not found", async () => {
    const [owner, other] = [await makeUser(), await makeUser()];
    const ticketId = await openTicket(owner);
    await refused(service.getOwn(other, ticketId), TICKET_ERROR_CODES.notFound);
    await refused(
      service.addUserMessage(other, ticketId, "mine now", null),
      TICKET_ERROR_CODES.notFound,
    );
    const page = await service.listOwn(other, 1);
    assert.equal(page.total, 0);
    // Nothing changed on the owner's ticket.
    const ticket = await TicketModel.findById(ticketId).orFail();
    assert.equal(ticket.followupCount, 0);
  });

  it("lets admins read and list every ticket, with the customer's email", async () => {
    const [owner, admin] = [await makeUser(), await makeUser("admin")];
    const ticketId = await openTicket(owner);
    const out = await service.getAny(ticketId);
    assert.equal(out.user?.id, owner);
    const page = await service.listAll({ page: 1, status: null, search: "" });
    assert.equal(page.items[0]?.id, ticketId);
    assert.ok(page.items[0]?.user?.email.endsWith("@example.com"));
    void admin;
  });
});

describe("photos", () => {
  it("stores a photo as WebP under {ticketId}/{messageId}.webp", async () => {
    const user = await makeUser();
    const out = await service.create(
      user,
      { subject: "Broken page", description: "See the photo" },
      await png(),
    );
    const message = await TicketMessageModel.findOne({ ticketId: out.id }).orFail();
    assert.equal(
      message.attachment?.path,
      `${out.id}/${String(message._id)}.webp`,
    );
    assert.match(out.messages[0]?.imageUrl ?? "", /^\/tickets\/attachments\/[0-9a-f]{24}\?exp=\d+&sig=/);
  });

  it("re-encodes away metadata and caps the size at 2000 px", async () => {
    const user = await makeUser();
    const big = await sharp({
      create: { width: 2600, height: 1300, channels: 3, background: "#123456" },
    })
      .withMetadata({ exif: { IFD0: { Copyright: "secret" } } })
      .jpeg()
      .toBuffer();
    const out = await service.create(
      user,
      { subject: "Large photo", description: "Big one" },
      big,
    );
    const message = await TicketMessageModel.findOne({ ticketId: out.id }).orFail();
    const chunks: Buffer[] = [];
    const opened = await service.openAttachment(
      String(message._id),
      ...linkParts(out.messages[0]!.imageUrl!),
    );
    assert.equal(opened.status, "ok");
    if (opened.status !== "ok") return;
    for await (const chunk of opened.stream) chunks.push(chunk as Buffer);
    const meta = await sharp(Buffer.concat(chunks)).metadata();
    assert.equal(meta.format, "webp");
    assert.equal(meta.width, 2000);
    assert.equal(meta.exif, undefined);
  });

  it("refuses GIF, SVG, renamed text, broken images and files over 2 MB", async () => {
    const user = await makeUser();
    const gif = Buffer.from("GIF89a\x01\x00\x01\x00\x00\x00\x00;", "latin1");
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const text = Buffer.from("just text pretending to be photo.png");
    const fakePng = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from("not really a png"),
    ]);
    const huge = Buffer.concat([await png(), Buffer.alloc(2 * 1024 * 1024)]);
    for (const file of [gif, svg, text, fakePng, huge]) {
      await assert.rejects(
        service.create(user, { subject: "Bad photo", description: "x" }, file),
        /photo/i,
      );
    }
    assert.equal(await TicketModel.countDocuments(), 0);
    assert.equal(await storedFiles(), 0);
  });

  it("serves a photo only through a valid, unexpired link for that message", async () => {
    const user = await makeUser();
    const out = await service.create(
      user,
      { subject: "Photo link", description: "x" },
      await png(),
    );
    const url = out.messages[0]!.imageUrl!;
    const messageId = url.split("/").pop()!.split("?")[0]!;
    const [exp, sig] = linkParts(url);

    assert.equal((await service.openAttachment(messageId, exp, sig)).status, "ok");
    // No token, a token for another message, a changed expiry, an old one.
    assert.equal(
      (await service.openAttachment(messageId, undefined, undefined)).status,
      "denied",
    );
    const other = signLink(env.mediaSigningSecret, "0".repeat(24));
    assert.equal(
      (await service.openAttachment(messageId, String(other.exp), other.sig))
        .status,
      "denied",
    );
    assert.equal(
      (await service.openAttachment(messageId, String(Number(exp) + 1), sig))
        .status,
      "denied",
    );
    const old = signLink(
      env.mediaSigningSecret,
      messageId,
      new Date(Date.now() - (SIGNED_LINK_TTL_SECONDS + 5) * 1000),
    );
    assert.equal(
      (await service.openAttachment(messageId, String(old.exp), old.sig)).status,
      "denied",
    );
  });

  it("leaves no photo and gives the slot back when saving the message fails", async () => {
    const user = await makeUser();
    const ticketId = await openTicket(user);
    mock.method(service, "saveMessage", async () => {
      throw new Error("disk full");
    });
    await assert.rejects(
      service.addUserMessage(user, ticketId, "with photo", await png()),
      /disk full/,
    );
    assert.equal(await storedFiles(), 0);
    const ticket = await TicketModel.findById(ticketId).orFail();
    assert.equal(ticket.followupCount, 0);

    await assert.rejects(
      service.create(user, { subject: "Second one", description: "x" }, await png()),
      /disk full/,
    );
    assert.equal(await TicketModel.countDocuments(), 1);
    assert.equal(await storedFiles(), 0);
  });
});

describe("limits", () => {
  it("allows at most 5 tickets that are not closed", async () => {
    const [user, admin] = [await makeUser(), await makeUser("admin")];
    const ids: string[] = [];
    for (let made = 0; made < 5; made++) ids.push(await openTicket(user));
    await refused(openTicket(user), TICKET_ERROR_CODES.openLimit);
    // Closing one frees a place, but 5 in the hour is the other limit.
    await service.setStatus(admin, ids[0]!, "closed");
    await refused(openTicket(user), TICKET_ERROR_CODES.rateLimited);
  });

  it("allows at most 10 messages a minute", async () => {
    const [user, admin] = [await makeUser(), await makeUser("admin")];
    const ticketId = await openTicket(user);
    let sent = 1;
    while (sent < 10) {
      await service.addUserMessage(user, ticketId, "spam", null);
      sent++;
      if (sent % MAX_FOLLOWUPS === 1) {
        await service.addAdminMessage(admin, ticketId, "ok", null);
      }
    }
    await refused(
      service.addUserMessage(user, ticketId, "spam", null),
      TICKET_ERROR_CODES.rateLimited,
    );
  });
});

describe("admin search", () => {
  it("matches subject or email literally, regex characters included", async () => {
    const user = await makeUser();
    await service.create(
      user,
      { subject: "Price (IDR) wrong?", description: "x" },
      null,
    );
    await openTicket(user);
    const bySubject = await service.listAll({
      page: 1,
      status: null,
      search: "(IDR) wrong?",
    });
    assert.equal(bySubject.total, 1);
    const all = await service.listAll({ page: 1, status: null, search: ".*" });
    assert.equal(all.total, 0);
    const byEmail = await service.listAll({
      page: 1,
      status: "open",
      search: `person${emails}@`,
    });
    assert.equal(byEmail.total, 2);
  });
});

describe("text", () => {
  it("keeps what was typed, HTML included, minus invisible characters", () => {
    assert.equal(
      cleanBody("<script>alert(1)</script>‮\u0000 hi  \r\n\n\n\n\nbye"),
      "<script>alert(1)</script> hi\n\n\nbye",
    );
    assert.equal(cleanSubject("  Two\n lines​ here "), "Two lines here");
    assert.throws(() => cleanSubject("abc"));
    assert.throws(() => cleanBody(" ​ "));
    assert.throws(() => cleanBody("x".repeat(2001)));
  });
});

function linkParts(url: string): [string, string] {
  const query = new URLSearchParams(url.split("?")[1]);
  return [query.get("exp")!, query.get("sig")!];
}

describe("unread replies", () => {
  it("flags a reply or status change until the customer opens the ticket", async () => {
    const [user, admin] = [await makeUser(), await makeUser("admin")];
    const ticketId = await openTicket(user);
    assert.equal(await service.unreadCount(user), 0);

    await service.addAdminMessage(admin, ticketId, "Try again now", null);
    assert.equal(await service.unreadCount(user), 1);
    const listed = await service.listOwn(user, 1);
    assert.equal(listed.items[0]?.unread, true);

    const opened = await service.getOwn(user, ticketId);
    assert.equal(opened.unread, false);
    assert.equal(await service.unreadCount(user), 0);

    await service.setStatus(admin, ticketId, "closed");
    assert.equal(await service.unreadCount(user), 1);
    // Another customer never sees it.
    assert.equal(await service.unreadCount(await makeUser()), 0);
  });
});
