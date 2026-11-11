import { parseDataRoots } from "../utils/deploymentFolders";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

/**
 * True for "development" / "dev" and for any suffixed variant such as
 * "development-fedier" or "dev_api" (case-insensitive). The suffix lets several
 * development apps share one MongoDB server while each keeps its own database.
 */
export function isDevelopmentBuild(name: string): boolean {
  return /^(development|dev)([-_].+)?$/i.test(name);
}

/** The build name, which is also the database name. */
function build(): string {
  const raw = process.env.BUILD?.trim();
  if (!raw) return "development";
  if (/^(development|dev)$/i.test(raw)) return "development";
  return raw;
}

const MIN_JWT_SECRET_LENGTH = 32;

function jwtSecret(buildName: string): string {
  const value = required("JWT_SECRET");
  if (value.length < MIN_JWT_SECRET_LENGTH) {
    const message = `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters`;
    if (!isDevelopmentBuild(buildName)) throw new Error(message);
    console.warn(`[WARN] ${message} (allowed in development only)`);
  }
  return value;
}

/**
 * The Dokploy address without a trailing slash or `/api`, e.g.
 * "https://dokploy.example.com". Null when unset.
 */
export function dokployUrl(raw: string | undefined): string | null {
  const value = raw
    ?.trim()
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");
  return value || null;
}

/** A bare domain such as "example.com", or null when unset. */
export function deployDomain(raw: string | undefined): string | null {
  const value = raw
    ?.trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, "");
  return value || null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The Cloudflare tunnel's ID (a UUID). A tunnel token (what `cloudflared
 * tunnel run --token` takes) is accepted too: its ID is read from it, so the
 * token's secret is never sent anywhere. Null when unset or unreadable.
 */
export function cloudflareTunnelId(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (UUID.test(value)) return value.toLowerCase();
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(value, "base64").toString("utf8"),
    );
    const id =
      typeof decoded === "object" && decoded !== null
        ? (decoded as { t?: unknown }).t
        : undefined;
    if (typeof id === "string" && UUID.test(id)) {
      console.warn(
        "[WARN] CLOUDFLARE_TUNNEL_ID holds a tunnel token; using the tunnel ID inside it. Put just the ID there instead",
      );
      return id.toLowerCase();
    }
  } catch {
    // Not a token either; reported below.
  }
  console.warn(
    "[WARN] CLOUDFLARE_TUNNEL_ID is not a tunnel ID (a UUID such as 83a32c25-073c-4231-…), so deployments cannot be routed",
  );
  return null;
}

export const env = {
  port: Number(process.env.PORT) || 8000,
  build: build(),
  isDevelopment: isDevelopmentBuild(build()),
  mongodbUrl: required("MONGODB_URL"),
  frontendUrl: required("FRONTEND_URL"),
  brevoApiKey: required("BREVO_API_KEY"),
  brevoSenderEmail: required("BREVO_SENDER_EMAIL"),
  jwtSecret: jwtSecret(build()),
  // Optional: without both, the app runs but nothing can be deployed.
  dokployUrl: dokployUrl(process.env.DOKPLOY_URL),
  dokployApiKey: process.env.DOKPLOY_API_KEY?.trim() || null,
  // Every deployed host is "<subdomain>.<deployDomain>", routed through a
  // Cloudflare tunnel to Dokploy's Traefik. Optional like Dokploy.
  deployDomain: deployDomain(process.env.DEPLOY_DOMAIN),
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || null,
  cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN?.trim() || null,
  cloudflareTunnelId: cloudflareTunnelId(process.env.CLOUDFLARE_TUNNEL_ID),
  cloudflareTunnelService:
    process.env.CLOUDFLARE_TUNNEL_SERVICE?.trim() ||
    "http://dokploy-traefik:80",
  // Folders on the Dokploy host that customers' data lives in. A reset
  // only ever empties folders inside these; without it, reset is off.
  deployDataRoots: parseDataRoots(process.env.DEPLOY_DATA_ROOTS),
  // Uptime Kuma, which checks deployed services. Optional: without all
  // three, deployments work and the dashboard shows no status.
  uptimeKumaUrl:
    process.env.UPTIME_KUMA_URL?.trim().replace(/\/+$/, "") || null,
  uptimeKumaUsername: process.env.UPTIME_KUMA_USERNAME?.trim() || null,
  uptimeKumaPassword: process.env.UPTIME_KUMA_PASSWORD || null,
};
