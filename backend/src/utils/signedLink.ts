import { createHmac, timingSafeEqual } from "node:crypto";

/** How long a signed link to a private file works. */
export const SIGNED_LINK_TTL_SECONDS = 5 * 60;

function signature(secret: string, id: string, expires: number): Buffer {
  return createHmac("sha256", secret).update(`${id}.${expires}`).digest();
}

/** `exp` (unix seconds) and `sig` for a link to `id`, good for the TTL. */
export function signLink(
  secret: string,
  id: string,
  now: Date = new Date(),
): { exp: number; sig: string } {
  const exp = Math.floor(now.getTime() / 1000) + SIGNED_LINK_TTL_SECONDS;
  return { exp, sig: signature(secret, id, exp).toString("base64url") };
}

/**
 * Seconds the link has left, or null when it is expired, malformed or not
 * signed for `id`. Compared in constant time.
 */
export function verifyLink(
  secret: string,
  id: string,
  exp: unknown,
  sig: unknown,
  now: Date = new Date(),
): number | null {
  if (typeof exp !== "string" || !/^\d{1,12}$/.test(exp)) return null;
  if (typeof sig !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(sig)) return null;
  const expires = Number(exp);
  const left = expires - Math.floor(now.getTime() / 1000);
  if (left <= 0 || left > SIGNED_LINK_TTL_SECONDS) return null;
  const given = Buffer.from(sig, "base64url");
  const wanted = signature(secret, id, expires);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
    return null;
  }
  return left;
}
