# Fedier product rules

Everything the backend checks when a product is saved. In the codebase these
live in `backend/src/validation/product.ts`, `backend/src/utils/deployment.ts`
and `backend/src/utils/dockerCompose.ts`; if you can read those, they win.

## Contents
1. Product fields
2. Deployment
3. Built-in variables and template syntax
4. Variables and visibility
5. Compose file rules
6. Domains and commands
7. Variants

## 1. Product fields

| field | type | rule / default |
|---|---|---|
| `name` | string | required, ≤ 60 chars, unique (soft-deleted products still hold their name) |
| `kind` | `"subscription"` \| `"oneTime"` | default `subscription`; cannot change later |
| `color` | string | `#rrggbb` |
| `pricingText` | string | ≤ 120, e.g. `Rp 99.000 / bulan`; shown instead of the raw price |
| `description` | string | Markdown, ≤ 4000 |
| `notices` | `{ tone: "info" \| "warning", text }[]` | ≤ 20, text Markdown ≤ 1000. `warning` = something the customer can lose |
| `priceIdr` | integer | whole rupiah, ≥ 0 |
| `durationDays` | integer | subscription only, ≥ 1, default 30; `null` for oneTime |
| `deployment` | object \| null | subscription only (section 2); `null` = nothing to deploy |
| `variantName` | string | subscription only, ≤ 60; base variant's name, e.g. `2 cores / 2 GB` |
| `variantSpecs` | string | subscription only, ≤ 300 |
| `variants` | array | subscription only, ≤ 10 (section 7) |
| `accessUrl` | string \| null | oneTime only, `http(s)://…`, never shown publicly |
| `showOnPricingPage` | boolean | default `false`; `true` lists it and opens checkout |

Images are uploaded after creation: ≤ 10, ≤ 5 MB each, first is the cover.

## 2. Deployment

```json
{
  "type": "dockerCompose",
  "projectId": "<Dokploy project id, [A-Za-z0-9_-]{1,100}>",
  "name": "n8n-${USERNAME}",
  "composeFile": "<YAML as one string, ≤ 100000 chars>",
  "variables": [],
  "domains": [],
  "commands": []
}
```

- `projectId`: the Dokploy project every customer's compose goes into. Ask the
  user for it, or list projects with a Dokploy tool if one is available.
- `name`: the compose's name in Dokploy per customer. Must render differently
  per customer (include `${USERNAME}`), lowercase letters, digits, `-`, `_`,
  starting with a letter or digit, ≤ 63 chars for a 32-char username. May use
  only built-ins and `readOnly`/`hidden` variables.

## 3. Built-in variables and template syntax

Set for every customer, never define them yourself:

- `${USERNAME}`: from the email's local part, lowercase letters and digits,
  up to 32 chars (e.g. `janedoe42`).
- `${EMAIL}`, `${USER_ID}` (24-char hex), `${DOMAIN}` (the platform's deploy
  domain, same for everyone).

Templates (name, subdomains, variable values, compose file) use only
`${NAME}`. A literal dollar sign is `$$` (bcrypt hashes, shell `$VAR`). Any
other `$` is an error.

## 4. Variables and visibility

`{ "key": "N8N_ENCRYPTION_KEY", "value": "...", "visibility": "hidden" }`

- key: letters, digits, `_`, not starting with a digit, ≤ 100, unique, not a
  built-in.
- value: one line, ≤ 4000; may reference only built-ins (not other
  variables). Not just the bare word `USERNAME`: write `${USERNAME}`.
- Every `${X}` in the compose file must be a built-in or a defined variable;
  every variable should be used in the compose file (else it's a warning).

| visibility | customer sees | customer sets | typical use |
|---|---|---|---|
| `hidden` | no | no | secrets, internal config |
| `readOnly` | yes | no | info such as a URL |
| `editable` | yes | any time; value is the default | preferences |
| `setOnce` | yes | once, before first deploy; value is just a placeholder | admin email |
| `setOnceHidden` | not after filling | once | first admin password |

- A variable the customer sets (`editable`, `setOnce`, `setOnceHidden`) must
  not appear in a volume's source path: they could mount any server folder.
- Names and subdomains may not use customer-set variables.
- A fixed `hidden` secret is shared by every customer. For per-customer
  secrets ask the user whether shared is fine or use `setOnceHidden`. Never
  derive a secret from built-ins; they are not secret.

## 5. Compose file rules

- Needs a `services:` section with at least one service; each needs `image`.
- `restart` must be `no`, `always`, `unless-stopped` or `on-failure`.
- `container_name`: omit it, or include `${USERNAME}`; letters, digits, `.`,
  `_`, `-`.
- `ports`: avoid fixed host ports (only one customer per server could use
  them). Use `expose` and a domain.
- Volumes: named volumes must be declared under top-level `volumes:`. Host
  folders shared by everyone are a warning; include `${USERNAME}`. Host
  folders inside the backend's `DEPLOY_DATA_ROOTS` (e.g. `/mnt/nas-sd*/…`)
  can be reset per customer; others cannot.
- Pass variables with `environment: - KEY=${KEY}`.
- `depends_on` must name existing services, not itself.

## 6. Domains and commands

Domain: `{ "serviceName": "n8n", "subdomain": "n8n-${USERNAME}", "port": 5678 }`
- `serviceName` is a compose service; `port` is the container's internal port.
- `subdomain` is one DNS label (no dots), lowercase/digits/`-`, ≤ 63 rendered,
  unique, different per customer. Host = `<subdomain>.<DOMAIN>`. ≤ 20 domains.

Command: `{ "id": "reset-owner", "label": "Reset owner password", "serviceName": "n8n", "command": "n8n user-management:reset" }`
- `id` `[A-Za-z0-9_-]{1,40}`, unique, stable; `label` ≤ 60 (customers see
  only this); `command` one line, ≤ 2000, run with `sh -c` in that service's
  running container. ≤ 20 commands.

## 7. Variants

```json
{ "name": "4 cores / 4 GB", "specs": "...", "pricingText": "", "description": "",
  "priceIdr": 149000, "durationDays": 30, "deployment": null }
```

- Omit `id` on create; one is generated.
- `deployment: null` deploys the product's own settings. Otherwise
  `{ composeFile, variables, domains, commands }` (no projectId or name: those
  stay the product's). Its compose must mount the same sources as the
  product's, so a customer switching variant keeps their data.
- Empty `pricingText` / `description` fall back to the price / product's.
