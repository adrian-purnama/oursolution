import type { NextFunction, Request, Response } from "express";
import { authenticateByToken } from "../../middleware/authenticate";
import { readBearer } from "../../middleware/requireAuth";
import { logger } from "../../logger/logger";
import type { BillingRegion } from "../../models/user/user.interface";
import { UserModel } from "../../models/user/user.model";
import { paddleProvider } from "./payment.service";

const logSource = "modules/payment/billingRegion.ts";

/** Indonesia's time zones; any other real one is somewhere else. */
const INDONESIAN_ZONES = /^Asia\/(Jakarta|Pontianak|Makassar|Jayapura)$/;

/**
 * Where a request comes from, or null when it cannot tell. Cloudflare's
 * CF-IPCountry header first ("XX" unknown, "T1" Tor); without it, the time
 * zone the frontend sends (X-Client-Timezone). Pure; exported for tests.
 */
export function regionHint(headers: {
  country?: string | null;
  timezone?: string | null;
}): BillingRegion | null {
  const country = headers.country?.trim().toUpperCase();
  if (country && /^[A-Z]{2}$/.test(country) && !["XX", "T1"].includes(country)) {
    return country === "ID" ? "ID" : "INTL";
  }
  const zone = headers.timezone?.trim();
  if (zone && /^[A-Za-z_]+\/[A-Za-z_/+-]+$/.test(zone)) {
    return INDONESIAN_ZONES.test(zone) ? "ID" : "INTL";
  }
  return null;
}

export function regionHintOf(req: Request): BillingRegion | null {
  return regionHint({
    country: req.header("cf-ipcountry"),
    timezone: req.header("x-client-timezone"),
  });
}

/**
 * The region a request is priced in. Without Paddle everyone is billed in
 * Indonesia. A signed-in user keeps the region on their account; anyone
 * else is placed by where the request comes from, Indonesia when unknown.
 */
export async function regionForRequest(req: Request): Promise<BillingRegion> {
  if (!paddleProvider) return "ID";
  const token = readBearer(req);
  if (token) {
    try {
      const user = await authenticateByToken(token);
      if (user.billingRegion) return user.billingRegion;
    } catch {
      // An expired or bad token prices like a visitor.
    }
  }
  return regionHintOf(req) ?? "ID";
}

/**
 * After requireUser: until the region is locked (first checkout, or an
 * admin), it follows where the user is, so the basket and checkout charge
 * what the shop showed them.
 */
export async function rememberBillingRegion(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  const hint = regionHintOf(req);
  if (
    paddleProvider &&
    user &&
    hint &&
    !user.billingRegionLocked &&
    user.billingRegion !== hint
  ) {
    try {
      await UserModel.updateOne(
        { _id: user._id, billingRegionLocked: { $ne: true } },
        { $set: { billingRegion: hint } },
      ).exec();
      user.billingRegion = hint;
    } catch (error) {
      logger.warn(
        `Could not save the billing region of ${user.id as string}: ${error instanceof Error ? error.message : String(error)}`,
        logSource,
        "rememberBillingRegion",
      );
    }
  }
  next();
}
