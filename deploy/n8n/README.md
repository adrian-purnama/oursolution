# n8n hosting product

Settings for the n8n subscription product in the admin panel. The compose
file is [docker-compose.yml](docker-compose.yml).

## Deployment

| Field  | Value                                                       |
| ------ | ----------------------------------------------------------- |
| Name   | `n8n-${USERNAME}`                                           |
| Domain | service `n8n`, subdomain `n8n-${USERNAME}`, port `5678`     |

## Variables

| Key                  | Visibility | Value                                        |
| -------------------- | ---------- | -------------------------------------------- |
| `POSTGRES_PASSWORD`  | hidden     | a long random string (`openssl rand -hex 32`) |
| `RUNNERS_AUTH_TOKEN` | hidden     | a different long random string               |
| `TIMEZONE`           | editable   | `Asia/Jakarta`                               |

Values may only use the built-ins (`${USERNAME}`, `${EMAIL}`, `${USER_ID}`,
`${DOMAIN}`); write a literal `$` as `$$`. Never make a variable that appears
in a volume path editable: the app refuses it.

## Data and deletion

Each customer's data is in `/mnt/nas-sda/n8n/<username>/`:

- `postgres/` — workflows, credentials (encrypted), executions
- `n8n/` — n8n settings, including the generated encryption key

Both are inside `DEPLOY_DATA_ROOTS=/mnt/nas-sd*` and differ per customer, so
"Reset" and the admin "Delete data" empty both. They must be emptied together:
a database without its `n8n/config` cannot decrypt saved credentials.

## Limits per customer

| Service      | CPU  | Memory | Processes |
| ------------ | ---- | ------ | --------- |
| postgres     | 0.5  | 512 MB | 200       |
| n8n          | 1.0  | 1 GB   | 512       |
| task-runners | 1.0  | 512 MB | 256       |

Disk use is not capped by Docker: bind folders can grow until the NAS is full.
Executions are pruned after 7 days or 10,000 rows, and successful runs are not
saved, which keeps the database small. For a hard cap, put a filesystem quota
on each customer folder (an XFS project quota or a ZFS dataset per customer).
