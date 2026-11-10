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
| `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` | backend | Transactional email |
| `JWT_SECRET` | backend | At least 32 characters; shorter values are refused outside development |
| `VITE_API_URL` | frontend | Base URL of the backend |

Give every app and environment its own `BUILD` value so they never share a database.

## Products and plans

A **product** is something a user can have. It has a name, a color, an image
(public, stored in the same GridFS bucket as the app logo and served from
`/media/:id`), a pricing text (what visitors read), a price in rupiah (what one
checkout charges) and a "show on pricing page" switch (which also opens it to
checkout). Every product has a **kind**, fixed when it is created:

- **Subscription** (hosting): active for a period. It has the number of days one
  checkout buys, and lives on the user's plan timeline.
- **One-time purchase** (for example an n8n workflow): bought once and kept for
  good. It has an optional **access link**, shown only to owners on their
  profile. Owning one is a `Purchase` (unique per user and product).

A user's **plan** is their subscriptions, each on its own timeline of periods
(`UserProductPeriod`: product, start, end, source). Periods of the same product
never overlap; different products overlap freely, so a user can have several
subscriptions active at once. **There is no default**: time not covered by a
period means that subscription is not active. The plan is drawn as a Gantt chart
on the user's profile and on the admin user page.

From a user's page an admin can, per subscription:

- **Start now**: cuts its running period short and starts a new one.
- **Add after this product's schedule**: queues a period after its last one.
- **Stop**: ends the running period now; scheduled periods are kept.
- **Delete a scheduled period**: only periods that have not started.

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
