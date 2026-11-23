---
name: create-product
description: Create a Fedier product — a hosted subscription deployed with Docker Compose through Dokploy, or a one-time product such as an n8n workflow — one product at a time. Gathers the details, writes the description, compose file, environment variables, domains and commands, checks them against Fedier's rules, and produces the exact JSON for POST /admin/products (or saves it directly when the admin API is reachable). Use this whenever the user wants to add, create, set up, draft or price a product, plan, package, service or offering for Fedier, or asks for a compose file or env variables for a Fedier product, even if they don't say "skill" or "API".
---

# Create a Fedier product

Fedier sells hosted services (subscriptions) and one-time products. Admins
create them with `POST /admin/products`. The backend is strict: one bad `$`,
a missing variable or a subdomain that is the same for every customer and
the save fails. This skill gets it right the first time.

Work on **one product per run**: finish it (JSON ready or saved, images
handled, summary given) before starting the next. Mixing products makes
mistakes in names and variables easy.

Read `references/rules.md` before drafting a deployment: it holds every
limit and rule. `references/example-product.json` is a complete, valid
subscription to model yours on.

## 1. Pick a mode

- **Direct mode**: you can run shell commands *and* reach the backend (Claude
  Code in the Fedier repo, with `admin.env.local` next to this file holding
  `FEDIER_API_URL` and `FEDIER_ADMIN_JWT`). Use `scripts/api.sh`; it checks and
  saves for you. Copy `admin.env.example` to `admin.env.local` if missing and
  ask the user to paste the token (an admin's `auth_token` from the site's
  localStorage). Never sign in with a password and never echo the token.
- **Draft mode**: anywhere else, e.g. a normal claude.ai chat, where
  `localhost` and the user's API are out of reach. You produce the final
  `product.json` and the commands the user runs to save it. Don't try to call
  their API from a sandbox.

## 2. Gather the details

Ask only for what's missing; propose sensible values and let the user
correct them rather than interrogating them field by field.

- kind: `subscription` (hosted, has a period) or `oneTime` (kept forever).
- name (unique), color, price in rupiah, pricing text.
- what it is, so you can write the Markdown description and any notices
  (use a `warning` notice for things a customer can lose).
- Subscription: duration, base variant name/specs, extra variants, the app
  to deploy (image and version, port, what data it stores, what the
  customer should configure), and the Dokploy project id.
- One-time: the access link.
- Images: files the user has, uploaded after creation.
- Keep `showOnPricingPage: false` unless the user says to publish.

## 3. Draft the deployment (subscriptions)

The key ideas, details in `references/rules.md`:

- Every customer gets their own copy, so the compose `name` and each domain
  `subdomain` must include `${USERNAME}` (e.g. `n8n-${USERNAME}`).
- Built-ins `${USERNAME}`, `${EMAIL}`, `${USER_ID}`, `${DOMAIN}` are always
  set; never define them. Write a literal `$` as `$$`.
- Every other `${X}` in the compose file needs a variable, with a visibility
  chosen for who should see or set it. Secrets the customer must choose (an
  admin password, an encryption key) are `setOnceHidden`.
- No fixed host ports: use `expose` plus a domain. Pin image versions.
- Use named volumes (declared at the top level), or host folders that
  include `${USERNAME}`; never let a customer-set variable pick a mount path.
- Offer useful customer commands (password reset, cache clear) when the app
  has them.

## 4. Check

**Direct mode**: write `{ name, composeFile, variables, domains }` to
`draft.json` (in a scratch directory) and run
`bash scripts/api.sh POST /admin/products/deployment/check draft.json`.
`data.valid` must be true; fix each `error`, and fix or mention each
`warning`. Show the user `data.preview` (rendered name and hosts).

**Draft mode**: walk the checklist yourself against `references/rules.md`:
every `${…}` defined or built-in; no stray `$`; name and subdomains include
`${USERNAME}` and render to valid lowercase labels; domain services exist
in the compose file; ports 1–65535; lengths within limits; customer-set
variables not in mounts or names. Render the preview for user `janedoe42`
(e.g. `n8n-janedoe42.<their domain>`) and show it.

## 5. Confirm, then save

Show a short summary first: name, kind, price/duration, Dokploy project,
preview host(s), each variable with its visibility, whether it goes on the
pricing page. Save only after the user confirms.

**Direct mode**:
```bash
bash scripts/api.sh POST /admin/products product.json
bash scripts/api.sh UPLOAD /admin/products/<id>/images cover.png   # per image, cover first
```
`data.id` in the response is the product id. A failed save returns a
`message` that names the problem: fix and retry. Later edits use
`PATCH /admin/products/<id>` with only the changed fields (`kind` is fixed).

**Draft mode**: give the complete `product.json` in one code block (as a
downloadable file too if you can create files), then these commands for the
user, filling in the API URL and leaving the token as a placeholder:

```bash
curl -X POST "$FEDIER_API_URL/admin/products/deployment/check" -H "Authorization: Bearer $FEDIER_ADMIN_JWT" -H "Content-Type: application/json" --data-binary @draft.json
curl -X POST "$FEDIER_API_URL/admin/products" -H "Authorization: Bearer $FEDIER_ADMIN_JWT" -H "Content-Type: application/json" --data-binary @product.json
curl -X POST "$FEDIER_API_URL/admin/products/<id>/images" -H "Authorization: Bearer $FEDIER_ADMIN_JWT" -F "file=@cover.png"
```

Mention they can instead paste the fields into the admin area's product
form, and that if the check returns errors they can paste them back to you.

## 6. Report

Product id (direct mode), name, whether it's on the pricing page, preview
host(s). Nothing deploys until a customer subscribes and turns the service
on; to try it, assign the product to a test user in the admin area. Then ask
whether to do the next product.
