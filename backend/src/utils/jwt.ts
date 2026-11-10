import jwt from "jsonwebtoken";
import { env } from "../environment/env";

const ALGORITHM = "HS256";

export type AccessTokenPayload = {
  userId: string;
  email: string;
  /** Must match the user's current tokenVersion; tokens without it count as 0. */
  tokenVersion: number;
};

export function signAccessToken(payload: {
  userId: string;
  email: string;
  rememberMe: boolean;
  tokenVersion?: number;
}): string {
  return jwt.sign(
    {
      userId: payload.userId,
      email: payload.email,
      tokenVersion: payload.tokenVersion ?? 0,
    },
    env.jwtSecret,
    {
      algorithm: ALGORITHM,
      expiresIn: payload.rememberMe ? "30d" : "1h",
    },
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret, {
    algorithms: [ALGORITHM],
  });

  if (typeof decoded === "string" || !decoded || typeof decoded !== "object") {
    throw new Error("Invalid token");
  }

  const { userId, email, tokenVersion } =
    decoded as Partial<AccessTokenPayload>;

  if (!userId || !email) {
    throw new Error("Invalid token payload");
  }

  return {
    userId,
    email,
    tokenVersion: typeof tokenVersion === "number" ? tokenVersion : 0,
  };
}
