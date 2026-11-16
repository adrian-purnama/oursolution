import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, describe, it } from "node:test";
import express from "express";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import sharp from "sharp";
import { ProductModel } from "../../models/product/product.model";
import { TicketModel } from "../../models/ticket/ticket.model";
import { TicketMessageModel } from "../../models/ticketMessage/ticketMessage.model";
import { UserModel } from "../../models/user/user.model";
import { signAccessToken } from "../../utils/jwt";
import { LlmService } from "../llm/llm.service";
import adminRoutes from "../admin/admin.route";
import {
  TICKET_ERROR_CODES,
  TicketError,
  TicketService,
} from "./ticket.service";
import {
  SUMMARY_INPUT_MAX,
  SUMMARY_MAX,
  buildSummaryPrompt,
} from "./ticket.summary";

// ------------------------------------------------------------ fake model

type Reply = { status?: number; body?: string; delayMs?: number };
let llmServer: Server;
let llmBase: string;
let reply: () => Reply;
let prompts: { messages: { role: string; content: string }[] }[];

function completion(content: unknown): Reply {
  return {
    body: JSON.stringify({
      choices: [{ message: { role: "assistant", content } }],
    }),
  };
}

// ------------------------------------------------------------ app + db

let mongo: MongoMemoryServer;
let api: Server;
let apiBase: string;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "ticket-close-test" });
  await Promise.all([
    TicketModel.init(),
    TicketMessageModel.init(),
    ProductModel.init(),
    UserModel.init(),
  ]);

  llmServer = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk: Buffer) => (raw += chunk.toString("utf8")));
    req.on("end", () => {
      prompts.push(JSON.parse(raw));
      const answer = reply();
      const send = () => {
        if (res.destroyed) return;
        res.writeHead(answer.status ?? 200, {
          "Content-Type": "application/json",
        });
        res.end(answer.body ?? "");
      };
      if (answer.delayMs) setTimeout(send, answer.delayMs);
      else send();
    });
  });
  llmServer.listen(0);
  await new Promise<void>((resolve) => llmServer.once("listening", resolve));
  llmBase = `http://127.0.0.1:${(llmServer.address() as AddressInfo).port}`;

  const app = express();
  app.use(express.json());
  app.use("/admin", adminRoutes);
  api = app.listen(0);
  await new Promise<void>((resolve) => api.once("listening", resolve));
  apiBase = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
});

after(async () => {
  for (const server of [llmServer, api]) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await mongoose.disconnect();
  await mongo.stop();
});

// ------------------------------------------------------------ per test

type Sent = {
  input: Record<string, unknown>;
  customEmail?: (to: string) => Promise<boolean>;
};
let sent: Sent[];
let mails: { to: string; title: string; body: string; url: string | null }[];
let notifyFails: boolean;
let service: TicketService;

beforeEach(async () => {
  prompts = [];
  sent = [];
  mails = [];
  notifyFails = false;
  reply = () =>
    completion(
      "The customer could not log in. Support reset the password. Solved.",
    );
  service = new TicketService({
    llm: new LlmService({
      baseUrl: llmBase,
      apiKey: "test-key",
      model: "bonsai2",
      timeoutMs: 1_000,
      maxTokens: 512,
    }),
    notifications: {
      send: async (input, options) => {
        if (notifyFails) throw new Error("notification store down");
        sent.push({
          input: input as Record<string, unknown>,
          customEmail: options?.customEmail,
        });
        return [];
      },
    },
    mailer: {
      sendNotification: async (to, mail) => {
        mails.push({ to, ...mail });
        return true;
      },
    },
    appBaseUrl: "https://app.test",
  });
  const db = mongoose.connection.db!;
  for (const collection of await db.collections()) {
    await collection.deleteMany({});
  }
});

let counter = 0;
async function makeUser(role: "user" | "admin" = "user") {
  counter += 1;
  const email = `close${counter}@example.com`;
  const user = await UserModel.create({
    email,
    hashedPassword: "x",
    isBlocked: false,
    role,
  });
  return { id: String(user._id), email };
}

async function makeProduct(name: string, extra: Record<string, unknown> = {}) {
  const product = await ProductModel.create({
    name,
    kind: "oneTime",
    color: "#123456",
    priceIdr: 1000,
    ...extra,
  });
  return String(product._id);
}

async function png(): Promise<Buffer> {
  return sharp({
    create: { width: 8, height: 8, channels: 3, background: "#00aa00" },
  })
    .png()
    .toBuffer();
}

async function photosOf(ticketId: string): Promise<number> {
  return mongoose.connection
    .db!.collection("ticketAttachments.files")
    .countDocuments({ filename: { $regex: `^${ticketId}/` } });
}

/** A ticket with a photo from each side and a few messages. */
async function busyTicket() {
  const [customer, admin] = [await makeUser(), await makeUser("admin")];
  const ticket = await service.create(
    customer.id,
    {
      subject: "Cannot log in",
      description: `My email is ${customer.email}, please help`,
    },
    await png(),
  );
  await service.addAdminMessage(
    admin.id,
    ticket.id,
    "Try resetting the password",
    await png(),
  );
  await service.addUserMessage(
    customer.id,
    ticket.id,
    "That worked, thanks",
    null,
  );
  return { customer, admin, ticketId: ticket.id };
}

async function closeRefused(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof TicketError, String(error));
    assert.equal(error.code, code);
    return true;
  });
}

const kinds = async (ticketId: string) =>
  (
    await TicketMessageModel.find({ ticketId }).sort({ createdAt: 1, _id: 1 })
  ).map((entry) => entry.kind);

// ------------------------------------------------------------ tests

describe("close without summary", () => {
  it("stores product and resolution and keeps messages and photos", async () => {
    const { admin, ticketId } = await busyTicket();
    const productId = await makeProduct("Hosting");
    const out = await service.close(admin.id, ticketId, {
      productId,
      resolution: "Password reset.\nAll good.",
      summarize: false,
    });
    assert.equal(out.summarized, false);
    assert.equal(out.ticket.status, "closed");
    assert.equal(out.ticket.closure?.productId, productId);
    assert.equal(out.ticket.closure?.productName, "Hosting");
    assert.equal(out.ticket.closure?.resolution, "Password reset.\nAll good.");
    assert.equal(out.ticket.closure?.summary, null);
    assert.equal(prompts.length, 0);
    assert.equal(await photosOf(ticketId), 2);
    assert.deepEqual(await kinds(ticketId), [
      "message",
      "message",
      "status",
      "message",
      "status",
    ]);

    const stored = await TicketModel.findById(ticketId);
    assert.equal(String(stored?.closedBy), admin.id);
    assert.ok(stored?.closedAt);
  });

  it("accepts Other, and a product hidden from customers or deleted", async () => {
    const admin = await makeUser("admin");
    const hidden = await makeProduct("Hidden", { showOnPricingPage: false });
    const deleted = await makeProduct("Gone", { deletedAt: new Date() });
    for (const productId of [null, hidden, deleted]) {
      const customer = await makeUser();
      const ticket = await service.create(
        customer.id,
        { subject: "Question", description: "Hi" },
        null,
      );
      const out = await service.close(admin.id, ticket.id, {
        productId,
        resolution: "Answered",
        summarize: false,
      });
      assert.equal(out.ticket.closure?.productId ?? null, productId);
    }
  });

  it("rejects a product that does not exist", async () => {
    const { admin, ticketId } = await busyTicket();
    await closeRefused(
      service.close(admin.id, ticketId, {
        productId: new mongoose.Types.ObjectId().toHexString(),
        resolution: "x",
        summarize: false,
      }),
      TICKET_ERROR_CODES.invalidProduct,
    );
    assert.equal((await TicketModel.findById(ticketId))?.status, "in_progress");
  });

  it("refuses to close a closed ticket (409)", async () => {
    const { admin, ticketId } = await busyTicket();
    await service.close(admin.id, ticketId, {
      productId: null,
      resolution: "Done",
      summarize: false,
    });
    await closeRefused(
      service.close(admin.id, ticketId, {
        productId: null,
        resolution: "Again",
        summarize: false,
      }),
      TICKET_ERROR_CODES.alreadyClosed,
    );
    assert.equal(sent.length, 1);
  });

  it("refuses closing through setStatus, and still reopens", async () => {
    const { admin, ticketId } = await busyTicket();
    await closeRefused(
      service.setStatus(admin.id, ticketId, "closed"),
      TICKET_ERROR_CODES.useCloseEndpoint,
    );
    await service.close(admin.id, ticketId, {
      productId: null,
      resolution: "Done",
      summarize: false,
    });
    const reopened = await service.setStatus(admin.id, ticketId, "open");
    assert.equal(reopened.status, "open");
    // Reopening keeps what the close recorded.
    assert.equal(reopened.closure?.resolution, "Done");
  });
});

describe("close with summary", () => {
  it("stores the summary and deletes messages, photos and the resolution", async () => {
    const { admin, customer, ticketId } = await busyTicket();
    const other = await busyTicket();
    const out = await service.close(admin.id, ticketId, {
      productId: null,
      resolution: "Reset the password for the customer",
      summarize: true,
    });
    assert.equal(out.summarized, true);
    assert.equal(
      out.ticket.closure?.summary,
      "The customer could not log in. Support reset the password. Solved.",
    );
    assert.equal(out.ticket.closure?.resolution, null);
    // Status events stay; every message is gone.
    assert.deepEqual(await kinds(ticketId), ["status", "status"]);
    assert.equal(await photosOf(ticketId), 0);
    // Another ticket is untouched.
    assert.equal(await photosOf(other.ticketId), 2);
    // The follow-up count is left as it was.
    assert.equal((await TicketModel.findById(ticketId))?.followupCount, 1);

    const customerView = await service.getOwn(customer.id, ticketId);
    assert.equal(customerView.closure?.productName, undefined);
    assert.equal(customerView.closure?.summary, out.ticket.closure?.summary);
  });

  it("sends only labelled text: no customer email, ids or images", async () => {
    const { admin, customer, ticketId } = await busyTicket();
    await service.close(admin.id, ticketId, {
      productId: null,
      resolution: "Reset done",
      summarize: true,
    });
    assert.equal(prompts.length, 1);
    const [system, user] = prompts[0]!.messages;
    assert.equal(system?.role, "system");
    assert.match(system!.content, /untrusted data/);
    const text = user!.content;
    assert.match(text, /^Subject: Cannot log in\nProduct: Other/);
    assert.match(text, /Customer: My email is \[email\], please help/);
    assert.match(text, /Admin: Try resetting the password/);
    assert.match(text, /Resolution: Reset done$/);
    for (const secret of [
      customer.email,
      customer.id,
      admin.id,
      ticketId,
      "@",
    ]) {
      assert.ok(
        !JSON.stringify(prompts[0]).includes(secret),
        `prompt contains ${secret}`,
      );
    }
    assert.doesNotMatch(text, /webp|imageUrl|data:/);
  });

  it("sanitizes and caps the summary", async () => {
    const { admin, ticketId } = await busyTicket();
    reply = () =>
      completion(`\u0000Line one‮\r\n\n\n\nLine two ${"x".repeat(3000)}`);
    const out = await service.close(admin.id, ticketId, {
      productId: null,
      resolution: "Done",
      summarize: true,
    });
    const summary = out.ticket.closure!.summary!;
    assert.ok(
      summary.startsWith("Line one\n\nLine two "),
      JSON.stringify(summary.slice(0, 30)),
    );
    assert.ok([...summary].length <= SUMMARY_MAX);
    // eslint-disable-next-line no-control-regex
    assert.doesNotMatch(summary, /[\u0000-\u0009\u000B-\u001F‮]/);
  });

  for (const [name, answer] of [
    ["an HTTP error", { status: 500, body: "{}" }],
    ["a timeout", { ...completion("late"), delayMs: 1_500 }],
    ["an empty answer", completion("   ")],
    ["malformed JSON", { body: "nope" }],
    ["only invisible characters", completion("​\u0007")],
  ] as const) {
    it(`falls back to a plain close on ${name}, deleting nothing`, async () => {
      const { admin, ticketId } = await busyTicket();
      reply = () => answer;
      const out = await service.close(admin.id, ticketId, {
        productId: null,
        resolution: "Fixed it",
        summarize: true,
      });
      assert.equal(out.summarized, false);
      assert.equal(out.ticket.status, "closed");
      assert.equal(out.ticket.closure?.resolution, "Fixed it");
      assert.equal(out.ticket.closure?.summary, null);
      assert.equal(await photosOf(ticketId), 2);
      assert.equal(
        (await kinds(ticketId)).filter((kind) => kind === "message").length,
        3,
      );
      assert.equal(sent.length, 1);
    });
  }
});

describe("concurrent closes", () => {
  for (const summarize of [false, true]) {
    it(`let exactly one succeed (summarize: ${summarize})`, async () => {
      const { admin, ticketId } = await busyTicket();
      const results = await Promise.allSettled(
        [1, 2].map(() =>
          service.close(admin.id, ticketId, {
            productId: null,
            resolution: "Done",
            summarize,
          }),
        ),
      );
      assert.equal(
        results.filter((result) => result.status === "fulfilled").length,
        1,
      );
      const failed = results.find((result) => result.status === "rejected");
      assert.equal(
        (failed as PromiseRejectedResult).reason.code,
        TICKET_ERROR_CODES.alreadyClosed,
      );
      assert.equal(sent.length, 1);
      const statusEvents = (await kinds(ticketId)).filter(
        (kind) => kind === "status",
      );
      assert.equal(statusEvents.length, 2); // open -> in_progress, then one close
    });
  }
});

describe("closing notification", () => {
  it("goes in-app and by email, linking to the ticket; the email has the summary and the full resolution", async () => {
    const { admin, customer, ticketId } = await busyTicket();
    const resolution = `We reset it.\n${"Long explanation. ".repeat(50).trim()}`;
    await service.close(admin.id, ticketId, {
      productId: null,
      resolution,
      summarize: true,
    });
    assert.equal(sent.length, 1);
    const { input, customEmail } = sent[0]!;
    assert.equal(input.userId, customer.id);
    assert.equal(input.channels, "both");
    assert.equal(input.link, `/support/${ticketId}`);
    assert.equal(input.title, "Your ticket was closed");
    assert.match(String(input.body), /Cannot log in/);
    // The summary is never in the notification.
    assert.doesNotMatch(JSON.stringify(input), /could not log in/);

    assert.ok(customEmail);
    assert.equal(await customEmail(customer.email), true);
    assert.equal(mails[0]?.to, customer.email);
    assert.ok(mails[0]!.body.includes(resolution));
    assert.ok(
      mails[0]!.body.includes(
        "Summary:\nThe customer could not log in. Support reset the password. Solved.",
      ),
    );
    assert.equal(mails[0]?.url, `https://app.test/support/${ticketId}`);
  });

  it("leaves the summary out of the email when the close was not summarized", async () => {
    const { admin, customer, ticketId } = await busyTicket();
    await service.close(admin.id, ticketId, {
      productId: null,
      resolution: "Done",
      summarize: false,
    });
    const { customEmail } = sent[0]!;
    assert.ok(customEmail);
    await customEmail(customer.email);
    assert.doesNotMatch(mails[0]!.body, /Summary:/);
    assert.match(mails[0]!.body, /Resolution:\nDone/);
  });

  it("failing does not undo the close", async () => {
    const { admin, ticketId } = await busyTicket();
    notifyFails = true;
    const out = await service.close(admin.id, ticketId, {
      productId: null,
      resolution: "Done",
      summarize: false,
    });
    assert.equal(out.ticket.status, "closed");
    assert.equal((await TicketModel.findById(ticketId))?.status, "closed");
  });
});

describe("summary prompt size", () => {
  it("drops the oldest middle messages first, keeping the first, the latest and the resolution", () => {
    const messages = Array.from({ length: 40 }, (_, index) => ({
      role: index % 2 ? ("admin" as const) : ("user" as const),
      body: `message ${index} ${"y".repeat(900)}`,
    }));
    const [, user] = buildSummaryPrompt({
      subject: "Big one",
      productName: "Hosting",
      messages,
      resolution: "The end",
    });
    const text = user!.content;
    assert.ok([...text].length <= SUMMARY_INPUT_MAX);
    assert.match(text, /Customer: message 0 /);
    assert.match(text, /message 39 /);
    assert.doesNotMatch(text, /message 1 /);
    assert.match(text, /\[\d+ earlier messages omitted\]/);
    assert.match(text, /Resolution: The end$/);
  });
});

describe("admin endpoints", () => {
  async function call(
    method: string,
    path: string,
    token: string,
    body?: unknown,
  ) {
    const res = await fetch(`${apiBase}/admin${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: res.status,
      json: (await res.json()) as { data: { code?: string } | null },
    };
  }
  const tokenOf = (user: { id: string; email: string }) =>
    signAccessToken({ userId: user.id, email: user.email, rememberMe: false });

  it("refuses non-admins (403)", async () => {
    const { customer, ticketId } = await busyTicket();
    const res = await call(
      "POST",
      `/tickets/${ticketId}/close`,
      tokenOf(customer),
      {
        productId: null,
        resolution: "I close it myself",
        summarize: false,
      },
    );
    assert.equal(res.status, 403);
    assert.equal((await TicketModel.findById(ticketId))?.status, "in_progress");
  });

  it("answers 400 for PATCH status closed and for bad close input", async () => {
    const { admin, ticketId } = await busyTicket();
    const patch = await call(
      "PATCH",
      `/tickets/${ticketId}/status`,
      tokenOf(admin),
      { status: "closed" },
    );
    assert.equal(patch.status, 400);
    assert.equal(patch.json.data?.code, TICKET_ERROR_CODES.useCloseEndpoint);

    for (const body of [
      { productId: "nope", resolution: "x", summarize: false },
      { productId: null, resolution: "   ", summarize: false },
      { productId: null, resolution: "x".repeat(1001), summarize: false },
      { productId: null, resolution: "x", summarize: "yes" },
    ]) {
      const res = await call(
        "POST",
        `/tickets/${ticketId}/close`,
        tokenOf(admin),
        body,
      );
      assert.equal(res.status, 400, JSON.stringify(body));
    }
    const badId = await call(
      "POST",
      `/tickets/not-an-id/close`,
      tokenOf(admin),
      {
        productId: null,
        resolution: "x",
        summarize: false,
      },
    );
    assert.equal(badId.status, 400);
    assert.equal((await TicketModel.findById(ticketId))?.status, "in_progress");
  });
});
