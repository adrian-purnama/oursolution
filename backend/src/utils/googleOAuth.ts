import { env } from "../environment/env";
import { normalizeEmail } from "./email";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const TIMEOUT_MS = 10_000;

/** Where Google sends the browser back to: a page on the frontend. */
export const GOOGLE_CALLBACK_PATH = "/auth/google/callback";

export interface GoogleProfile {
  /** Google's stable id for the account ("sub"); the email can change. */
  googleId: string;
  email: string;
}

export function googleRedirectUri(): string {
  return `${env.frontendUrl.replace(/\/+$/, "")}${GOOGLE_CALLBACK_PATH}`;
}

/** Reads the claims of an ID token that came straight from Google over TLS. */
export function readIdToken(
  idToken: string,
  clientId: string,
  now = Date.now(),
): GoogleProfile {
  let claims: Record<string, unknown>;
  try {
    const payload = idToken.split(".")[1] ?? "";
    const decoded: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    if (typeof decoded !== "object" || decoded === null) throw new Error();
    claims = decoded as Record<string, unknown>;
  } catch {
    throw new Error("Google sign-in failed, please try again");
  }

  const { iss, aud, exp, sub, email, email_verified: verified } = claims;
  if (
    typeof iss !== "string" ||
    !ISSUERS.includes(iss) ||
    aud !== clientId ||
    typeof exp !== "number" ||
    exp * 1000 < now ||
    typeof sub !== "string" ||
    !sub
  ) {
    throw new Error("Google sign-in failed, please try again");
  }

  const normalized = normalizeEmail(email);
  if (!normalized || (verified !== true && verified !== "true")) {
    throw new Error("Your Google account has no verified email");
  }

  return { googleId: sub, email: normalized };
}

export const googleOAuth = {
  /** Trades the one-time code from Google's consent page for who signed in. */
  async exchangeCode(code: string): Promise<GoogleProfile> {
    const { googleClientId, googleClientSecret } = env;
    if (!googleClientId || !googleClientSecret) {
      throw new Error("Google sign-in is not available");
    }

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: googleRedirectUri(),
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const body: unknown = await response.json().catch(() => null);
    const idToken =
      typeof body === "object" && body !== null
        ? (body as { id_token?: unknown }).id_token
        : undefined;
    if (!response.ok || typeof idToken !== "string") {
      throw new Error("Google sign-in failed, please try again");
    }

    return readIdToken(idToken, googleClientId);
  },
};
