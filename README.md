# Fedier template

Starter for a web app with accounts and an admin area: an Express + MongoDB API
(`backend/`) and a TanStack Start + Tailwind frontend (`frontend/`).

## What is included

- Register with an emailed one-time code, login, forgot/reset password
- Two roles: `user` and `admin`. The first account to register becomes the admin
- Admins get the admin area (app config, users, products)
- Products with images, of two kinds: subscriptions (several active per user, each on its own timeline that admins can change and users extend by checkout) and one-time purchases kept for good. Payment is an allow-all stub for now
- App config: app name, logo, and switches to open or close login and registration
- Generic landing page, pricing page with checkout, dashboard, profile with a plan Gantt chart, and admin pages (config, users, products)

## Run it locally

Requirements: Node 22+, a MongoDB replica set (the logo upload uses a transaction), and a Brevo API key for email.

```bash
cd backend
cp .env.example .env   # then fill in the values
npm install
npm run dev            # http://localhost:8000
```

```bash
cd frontend
cp .env.example .env
npm install
npm run dev            # http://localhost:3000
```

Register the first account straight away: it is the one that becomes the admin.

## Environment

| Variable | Where | Notes |
| --- | --- | --- |
| `PORT` | backend | Defaults to 8000 |
| `BUILD` | backend | Also the **database name**, so every app and environment needs its own. `development` or `development-<name>` (for example `development-fedier`) counts as development: debug logs on, short `JWT_SECRET` tolerated |
| `MONGODB_URL` | backend | |
| `FRONTEND_URL` | backend | Allowed CORS origin and base of the reset-password link |
| `APP_BASE_URL` | backend | Optional. The site users open; notification emails link to `APP_BASE_URL` + the notification's relative path. Defaults to `FRONTEND_URL` |
| `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` | backend | Transactional email |
| `JWT_SECRET` | backend | At least 32 characters; shorter values are refused outside development |
| `VITE_API_URL` | frontend | Base URL of the backend |

Give every app and environment its own `BUILD` value so they never share a database.

## Products and plans

A **product** is something a user can have. It has a name, a color, an image
(public, stored in the same GridFS bucket as the app logo and served from
`/media/:id`), a pricing text (what visitors read), a price in rupiah (what one
checkout charges) and a "show on pricing page" switch. A listed product is open to checkout for
anyone. A hidden subscription can still be extended (from the profile) by
users who have it running or scheduled, but nobody new can buy it; a hidden
one-time product cannot be bought at all. Every product has a **kind**, fixed when it is created:

- **Subscription** (hosting): active for a period. It has the number of days one
  checkout buys, and lives on the user's plan timeline.
- **One-time purchase** (for example an n8n workflow): bought once and kept for
  good. It has an optional **access link**, shown only to owners on their
  profile. Owning one is a `Purchase` (unique per user and product).

**Deleting** a product is a soft delete (`deletedAt`), which can be restored
from the Deleted section on the admin Products page. A deleted product is
hidden from the pricing page and cannot be checked out, assigned or given, but
existing owners keep it (and its access link). A subscription can only be
deleted when nobody has it running or scheduled; a one-time product can always
be deleted. A deleted product can be removed for good only when no period,
purchase or payment refers to it.

A user's **plan** is their subscriptions, each on its own timeline of periods
(`UserProductPeriod`: product, start, end, source). Periods of the same product
never overlap; different products overlap freely, so a user can have several
subscriptions active at once. **There is no default**: time not covered by a
period means that subscription is not active. The plan is drawn as a Gantt chart
on the user's profile and on the admin user page; owned one-time products appear
on it too, as a bar from the purchase date that never expires.

From a user's page an admin can, per subscription:

- **Start now**: cuts its running period short and starts a new one.
- **Add after this product's schedule**: queues a period after its last one.
- **Stop**: ends the running period now; scheduled periods are kept.
- **Delete a period**: running or scheduled. A deleted running period is removed as if it never happened (Stop keeps it in history); ended periods cannot be deleted.

and, for one-time products, **give** one without payment or **take it back**.

**Checkout** (`POST /me/checkout`) goes through `modules/payment`: a `Payment`
is recorded and a `PaymentProvider` charges it. Once paid, a subscription gets a
period of its duration added after whatever the user already has of it (buying
again extends), and a one-time product becomes a `Purchase` (buying something
already owned is refused before any charge). The only provider today is `allowAllProvider`, which approves
every checkout without taking money. To add a real gateway, implement
`PaymentProvider` in `payment.provider.ts` and swap it in `payment.service.ts`;
a `pending` result with a `redirectUrl` is already passed to the frontend, and
a webhook would then mark the payment paid and grant the period.

Gate features with `userProductService.hasActiveProduct(userId, productId)` or
`getActiveProducts(userId)` (in `modules/userProduct/userProduct.service.ts`),
for admins and users alike. Both count running subscriptions and owned one-time
products. Change timelines only through the rules in
`modules/userProduct/userProduct.planner.ts`.

## Notifications

Users get notifications under the bell in the header, live over server-sent
events, and optionally by email (through `modules/mail/mail.service.ts`).
Other backend code sends them with one call; there is no HTTP endpoint for
sending.

```ts
import { notificationService } from "../notification/notification.service";

const results = await notificationService.send({
  userId,                    // or userIds: [...] (up to 500)
  title: "Your ticket has a reply",   // 1-100 chars, one line
  body: "An admin answered your question.", // 1-500 chars
  link: `/support/${ticketId}`,       // optional, relative path only
  channels: "both",          // "in_app" | "email" | "both"
});
```

- `in_app` stores the notification and pushes it to the user's open tabs.
  `email` only sends an email; nothing is stored. `both` does both.
- Emails go out in the background: the call does not wait for SMTP, and a
  failed email never affects the in-app part (it is logged).
- `send` throws `NotificationInputError` only for invalid input. Delivery
  problems come back per recipient: `inApp.status` is `stored`, `skipped`
  (unknown user, or not requested) or `failed`; `email.status` is `queued`,
  `skipped` or `failed`.
- Titles and bodies are stored as plain text (control characters removed)
  and rendered as text, never HTML. Do not put secrets in them.
- `link` must start with a single `/`; absolute URLs, `//`, `\`, schemes
  such as `javascript:` and anything over 300 characters are refused.
- Notifications are deleted by MongoDB 90 days after creation (TTL index).

User API, all behind `requireUser` and scoped to the caller (another user's
notification is a 404):

| | |
| --- | --- |
| `GET /notifications?cursor=&limit=` | Newest first, `limit` up to 50; pass `nextCursor` back as `cursor` |
| `GET /notifications/unread-count` | `{ count }` |
| `PATCH /notifications/:id/read` | Idempotent |
| `POST /notifications/read-all` | `{ updated }` |
| `GET /notifications/stream` | SSE. `notification` events whose id is the notification id; a heartbeat comment every 25s; send `Last-Event-ID` to get what was missed |

The stream needs the `Authorization` header, so the frontend reads it with
`fetch` (`frontend/src/lib/notification.ts`) instead of `EventSource`, and
reconnects with backoff. Open streams live in memory (at most 5 per user;
the oldest closes): this assumes **one backend instance**. Running several
needs a fan-out (MongoDB change streams or Redis pub/sub) in
`notification.stream.ts`. Behind nginx, `X-Accel-Buffering: no` is already
sent; other proxies must not buffer `/notifications/stream`.

To try it: sign in, then from a backend script or a temporary call in any
service run `notificationService.send({ userId, title, body, link: "/dashboard", channels: "both" })`.
The bell's badge updates without a refresh, and the email arrives with an
absolute link. `npm test` in `backend/` runs the notification tests against a
temporary MongoDB (`mongodb-memory-server`; the first run downloads MongoDB).

## Contact page and support tickets

`/contact` is public: the company's email, phone, WhatsApp, address, opening
hours and map link, edited by admins under Admin → Config → Contact details
(stored in the app config; empty fields are hidden). Its button leads
customers to `/support`.

`/support` (signed in) is where a customer opens tickets (subject 5–120
characters, description 1–2000, one optional photo) and follows each thread.
Admins work them at `/admin/tickets`: filter by status, search subject or
customer email, reply, and set the status (`open`, `in_progress`, `closed`).

Rules, all enforced in `modules/ticket/ticket.service.ts`:

- After opening a ticket the customer may send 3 follow-ups; the 4th is
  refused (`429`, `FOLLOWUP_LIMIT_REACHED`) until an admin replies, which
  resets the count. The slot is taken by one conditional update
  (`status != closed` and `followupCount < 3`), so concurrent sends cannot
  exceed it; it is given back if storing the message fails.
- An admin reply moves an `open` ticket to `in_progress`. A `closed` ticket
  refuses customer messages (`403`, `TICKET_CLOSED`) until an admin reopens
  it. Every status change is saved in the thread and logged (who, when, from,
  to).
- At most 5 tickets that are not closed per customer, 5 new tickets an hour,
  and 10 messages a minute (`429`). These are counted from the stored
  tickets and messages, so they hold across restarts and instances.
- Another customer's ticket answers `404`, never `403`.
- Text is stored as typed, minus control, zero-width and bidi-override
  characters, and rendered as text, never HTML.

Photos: JPEG, PNG or WebP up to 2 MB, recognised by their bytes (not name or
content type), re-encoded to WebP (quality 85, at most 2000 px, no metadata)
and stored in the private GridFS bucket `ticketAttachments` as
`{ticketId}/{messageId}.webp`. The bucket is created by the first upload and
has no public route. A photo is only served by
`GET /tickets/attachments/:messageId?exp=&sig=`: an HMAC-SHA256 of the message
id and expiry (5 minutes), signed with `MEDIA_SIGNING_SECRET` and handed out
only with a ticket its reader may see. Without a valid signature it answers
`403`; responses are `Cache-Control: private`.

Environment: `MEDIA_SIGNING_SECRET`, at least 32 characters (e.g.
`openssl rand -hex 32`). Required outside development; development makes a
random one per start.

To try it: set the contact details under Admin → Config, open `/contact`,
sign in as a customer, open a ticket with a photo at `/support` and send 3
follow-ups (the box then waits for an admin). As an admin, reply at
`/admin/tickets` and the customer can write again; close the ticket and the
box disappears. `npm test` in `backend/` runs
`modules/ticket/ticket.service.test.ts` against a temporary MongoDB: the
follow-up limit and reset, closed tickets, ownership, photo checks (type,
size, renamed files, signed links), clean-up after a failed save, the rate
limits, and concurrent follow-ups.

### Closing a ticket (with an optional AI summary)

Admins close a ticket only through the close dialog (choosing **Closed** in
the status menu opens it), which calls
`POST /admin/tickets/:id/close` with
`{ productId: ObjectId | null, resolution: string, summarize: boolean }`.
`PATCH /admin/tickets/:id/status` refuses `closed` (`400`,
`USE_CLOSE_ENDPOINT`); reopening and the other changes work as before.

- `productId` null means "Other"; otherwise any existing product, hidden or
  deleted ones included (an unknown id is `400`). The product's name is
  stored with the ticket as it was at close time.
- `resolution`: 1–1000 characters, cleaned like ticket messages.
- A closed ticket answers `409` (`TICKET_ALREADY_CLOSED`). The close is one
  conditional update (`status != closed`), so of two concurrent closes one
  wins and only it notifies or deletes anything.
- **Close ticket** stores the product and resolution; the thread stays.
- **Close and replace thread with summary** sends the ticket to the model
  (subject, product name, messages labelled `Customer:`/`Admin:`, the
  resolution; at most 12,000 characters, the oldest middle messages dropped
  first). No ids, names, emails (typed ones become `[email]`) or photos are
  sent; the prompt says the ticket content is untrusted data. On success the
  summary (plain text, cleaned, at most 1000 characters) is stored, the
  resolution is set to null, and every message and the photos
  (`ticketAttachments` files named `{ticketId}/…`) are deleted. Status
  changes stay. On a replica set the close and the message deletion run in
  one transaction; on a standalone server they run in that order. If
  deleting photos fails it is logged and the close stands.
- If the model fails, times out or returns nothing usable, the ticket closes
  the plain way, nothing is deleted, and the response says
  `summarized: false`.
- The customer gets an in-app notification ("Your ticket was closed", link
  `/support/<id>`) and an email that always holds the full resolution, also
  when it is deleted afterwards. A failing notification is logged and never
  undoes the close.
- Reopening keeps the product, resolution or summary and the follow-up
  count; new messages form a new thread. The close details show in the
  thread where the ticket was closed (product for admins only), rendered
  as text only.

LLM environment (backend `.env`), an OpenAI-compatible chat endpoint:

| Variable | Default | Meaning |
| --- | --- | --- |
| `LLM_BASE_URL` | unset | Base URL, e.g. `http://localhost:8080`; `/v1/chat/completions` is appended. Unset: summaries are off and tickets close without one. |
| `LLM_MODEL` | `bonsai2` | The `model` sent with each request. |
| `LLM_TIMEOUT_MS` | `30000` | The request is aborted after this. |
| `LLM_MAX_TOKENS` | `512` | Sent as `max_tokens`. |

No API key is sent. `modules/llm/llm.service.ts` (`llmService.chat`) is
generic: one request, no retries, a typed `LlmError` (`UNAVAILABLE`,
`TIMEOUT`, `HTTP_ERROR`, `BAD_RESPONSE`, `EMPTY`), and logs only the outcome
and duration, never text.

To try it: set `LLM_BASE_URL` to a running server, check it with
`curl $LLM_BASE_URL/v1/chat/completions -H "Content-Type: application/json" -d '{"model":"bonsai2","messages":[{"role":"user","content":"hi"}],"max_tokens":16}'`,
restart the backend, open a ticket with a photo and a few messages, then
close it from `/admin/tickets/<id>` with **Close and replace thread with
summary**. `npm test` covers it in `modules/llm/llm.service.test.ts` (a
local HTTP stub: request shape, timeout, errors) and
`modules/ticket/ticket.close.test.ts` (temporary MongoDB and a stub model:
both close modes, fallback on failure, sanitizing, the prompt's content and
size, products, concurrent closes, `409`, `400`, `403`, and the
notification).

## Commands

| | backend | frontend |
| --- | --- | --- |
| Dev server | `npm run dev` | `npm run dev` |
| Type check | `npm run type-check` | `npm run type-check` |
| Tests | `npm test` | none yet |
| Lint | none yet (see below) | `npm run lint` |
| Format | `npm run format` | `npm run format` |
| Production build | `npm run build` then `npm start` | `npm run build` |

The backend has no ESLint setup yet: `typescript-eslint` does not support the
TypeScript 7 compiler the backend uses.

## Layout

```
backend/src/
  modules/<feature>/     route -> controller -> service
  models/                Mongoose schemas and their interfaces
  middleware/            requireUser, requireAdmin, rate limits, uploads
  validation/            request parsing at the HTTP boundary
frontend/src/
  routes/                thin TanStack file routes (guard + page shell)
  components/home/       landing page sections (placeholder copy to replace)
  components/forms/      auth/, admin/ and shared/ form and CRUD components
  context/               auth and branding providers
  lib/                   API client, config, small helpers
```

Conventions for both halves are written down in `.cursor/rules/`.

## Security notes

- One-time codes are stored hashed, allow 5 wrong guesses and can be re-requested once a minute.
- Auth endpoints are rate limited per IP in memory; running several instances needs a shared store.
- Resetting a password, an admin changing it, or blocking a user signs that user out everywhere.
- Access tokens are kept in `localStorage`. Moving them to httpOnly cookies is the main hardening step left.
