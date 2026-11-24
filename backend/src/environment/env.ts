import { randomBytes } from "node:crypto";
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

/**
 * Sandbox unless MIDTRANS_URL points at production (a URL without
 * "sandbox", e.g. https://app.midtrans.com).
 */
export function midtransSandbox(raw: string | undefined): boolean {
  const value = raw?.trim();
  return !value || /sandbox/i.test(value);
}

/**
 * Whether Paddle is the sandbox, from PADDLE_URL like MIDTRANS_URL: a URL
 * with "sandbox" (https://sandbox-api.paddle.com) or without
 * (https://api.paddle.com). Never guessed: with an API key set, PADDLE_URL
 * is required, and keys of the other environment stop the app, so it never
 * charges on the wrong Paddle account. Without an API key it does not
 * matter (Paddle is off) and is sandbox.
 */
export function paddleSandbox(
  url: string | undefined,
  apiKey: string | undefined,
  clientToken: string | undefined,
): boolean {
  const key = apiKey?.trim();
  if (!key) return true;
  const value = url?.trim();
  if (!value) {
    throw new Error(
      "PADDLE_URL is required with PADDLE_API_KEY: https://sandbox-api.paddle.com or https://api.paddle.com",
    );
  }
  const sandbox = /sandbox/i.test(value);
  const where = sandbox ? "the sandbox" : "live";
  if (key.startsWith(sandbox ? "pdl_live_" : "pdl_sdbx_")) {
    throw new Error(
      `PADDLE_URL points at ${where}, but PADDLE_API_KEY is a ${sandbox ? "live" : "sandbox"} key`,
    );
  }
  const token = clientToken?.trim();
  if (token && token.startsWith(sandbox ? "live_" : "test_")) {
    throw new Error(
      `PADDLE_URL points at ${where}, but PADDLE_CLIENT_TOKEN is a ${sandbox ? "live" : "sandbox"} token`,
    );
  }
  return sandbox;
}

/** Where Midtrans reaches us, relative to the backend's public URL. */
export const MIDTRANS_NOTIFICATION_PATH = "/payments/midtrans/notification";

/** True for localhost, 127.x, ::1, 0.0.0.0 and *.localhost: unreachable from outside. */
function isLocalHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, "");
    return (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host === "0.0.0.0" ||
      host === "::1" ||
      /^127\./.test(host)
    );
  } catch {
    return true;
  }
}

/** The backend's public base URL without a trailing slash, or null. */
export function backendUrl(raw: string | undefined): string | null {
  const value = raw?.trim().replace(/\/+$/, "");
  return value || null;
}

/**
 * The URL sent to Midtrans as X-Override-Notification. An explicit
 * MIDTRANS_NOTIFICATION_URL wins; otherwise it is BACKEND_URL plus the
 * notification path. Null for a local address, which Midtrans cannot reach
 * (then the dashboard's URL applies and pending payments are polled).
 */
export function midtransNotificationUrl(
  explicit: string | undefined,
  backend: string | null,
): string | null {
  const url =
    explicit?.trim() ||
    (backend ? `${backend}${MIDTRANS_NOTIFICATION_PATH}` : null);
  if (!url || isLocalHost(url)) return null;
  return url;
}

/**
 * Signs the short-lived links to private ticket photos. Required outside
 * development; in development a random one is made per start, so links
 * from before a restart stop working (they last minutes anyway).
 */
export function mediaSigningSecret(
  raw: string | undefined,
  buildName: string,
): string {
  const value = raw?.trim() ?? "";
  if (value.length >= MIN_JWT_SECRET_LENGTH) return value;
  const message = value
    ? `MEDIA_SIGNING_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters`
    : "MEDIA_SIGNING_SECRET is required";
  if (!isDevelopmentBuild(buildName)) throw new Error(message);
  console.warn(`[WARN] ${message}; using a random one (development only)`);
  return randomBytes(32).toString("hex");
}

/** A whole number above 0, or null when unset or not one. */
export function positiveInt(raw: string | undefined): number | null {
  const value = Number(raw?.trim());
  return raw?.trim() && Number.isSafeInteger(value) && value > 0 ? value : null;
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
  // This API's public URL, e.g. "https://api.example.com". Used for links
  // that outside services call back, such as Midtrans notifications.
  backendUrl: backendUrl(process.env.BACKEND_URL),
  // The site users open, e.g. "https://app.example.com". Links in emails are
  // this plus a relative path. Defaults to FRONTEND_URL.
  appBaseUrl:
    backendUrl(process.env.APP_BASE_URL) ??
    required("FRONTEND_URL").replace(/\/+$/, ""),
  // Mail goes out over SMTP.
  smtpHost: required("SMTP_HOST"),
  smtpPort: Number(process.env.SMTP_PORT) || 465,
  smtpSecure: (process.env.SMTP_SECURE?.trim() ?? "true") !== "false",
  smtpUser: required("SMTP_USER"),
  smtpPassword: required("SMTP_PASSWORD"),
  mailFrom: required("MAIL_FROM"),
  jwtSecret: jwtSecret(build()),
  mediaSigningSecret: mediaSigningSecret(
    process.env.MEDIA_SIGNING_SECRET,
    build(),
  ),
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
  // Midtrans takes the payments. Without a server key, checkout is off
  // outside development (development approves checkouts without charging).
  midtransServerKey: process.env.MIDTRANS_SERVER_KEY?.trim() || null,
  // Public: lets the browser show Snap inside the page.
  midtransClientKey: process.env.MIDTRANS_CLIENT_KEY?.trim() || null,
  midtransSandbox: midtransSandbox(process.env.MIDTRANS_URL),
  // Where Midtrans posts payment notifications for our orders: BACKEND_URL
  // + /payments/midtrans/notification unless MIDTRANS_NOTIFICATION_URL says
  // otherwise. Null on localhost: Midtrans then uses the dashboard's URL,
  // and pending payments are still confirmed by polling.
  midtransNotificationUrl: midtransNotificationUrl(
    process.env.MIDTRANS_NOTIFICATION_URL,
    backendUrl(process.env.BACKEND_URL),
  ),
  // Google sign-in. Optional: without both, only email and password work.
  googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() || null,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || null,
  // How long an unpaid invoice can still be paid.
  paymentTtlMinutes: Number(process.env.PAYMENT_TTL_MINUTES) || 60,
  // Paddle bills customers outside Indonesia in USD. Optional: without an
  // API key only the Indonesian region can check out.
  paddleApiKey: process.env.PADDLE_API_KEY?.trim() || null,
  // Public: lets the browser open Paddle Checkout.
  paddleClientToken: process.env.PADDLE_CLIENT_TOKEN?.trim() || null,
  paddleWebhookSecret: process.env.PADDLE_WEBHOOK_SECRET?.trim() || null,
  paddleSandbox: paddleSandbox(
    process.env.PADDLE_URL,
    process.env.PADDLE_API_KEY,
    process.env.PADDLE_CLIENT_TOKEN,
  ),
  paddleTaxCategory: process.env.PADDLE_TAX_CATEGORY?.trim() || "standard",
  // Days before a subscription ends that its owner is reminded.
  expiryReminderDays: positiveInt(process.env.EXPIRY_REMINDER_DAYS) ?? 5,
  // An OpenAI-compatible chat endpoint (base only; /v1/chat/completions is
  // appended). Optional: without it, tickets close without a summary.
  llmBaseUrl:
    backendUrl(process.env.LLM_BASE_URL) ?? "https://api.deepseek.com",
  llmApiKey: process.env.DEEPSEEK_API_KEY?.trim() || null,
  llmModel: process.env.LLM_MODEL?.trim() || "deepseek-chat",
  llmTimeoutMs: positiveInt(process.env.LLM_TIMEOUT_MS) ?? 30_000,
  llmMaxTokens: positiveInt(process.env.LLM_MAX_TOKENS) ?? 512,
};
