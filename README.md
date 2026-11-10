# Fedier template

Starter for a web app with accounts and an admin area: an Express + MongoDB API
(`backend/`) and a TanStack Start + Tailwind frontend (`frontend/`).

## What is included

- Register with an emailed one-time code, login, forgot/reset password
- Two roles: `user` and `admin`. The first account to register becomes the admin
- Admins get the admin area (app config, users, plans)
- Plans, and a plan timeline per user that admins can change. Gating features by plan is not built yet
- App config: app name, logo, and switches to open or close login and registration
- Generic landing page, pricing page, dashboard shell and admin pages (config, users, plans)

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

## Plans

A plan has a name, a color, a pricing text (what visitors read), a price in
rupiah (what is charged), a "show on pricing page" switch and a default flag.
Exactly one plan is the default; a "Free" default is created on first start.

Each user has a timeline of plan periods (`UserPlanPeriod`: plan, start, end).
Periods never overlap. **Time not covered by a period is the default plan**, and
that is worked out when the plan is read rather than stored, so there can never
be a gap and nothing has to run when a period expires.

From a user's page an admin can:

- **Change now**: ends the running period immediately and starts a new one.
- **Add after the current schedule**: queues a period to start when the last scheduled one ends.
- **Delete a scheduled period**: only periods that have not started; the default covers that time.

`userPlanService.getCurrentPlan(userId)` returns the plan a user is on right
now. Use it to gate features. Subscriptions should create periods with
`source: "subscription"` through the same scheduling rules in
`modules/userPlan/userPlan.planner.ts`.

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
