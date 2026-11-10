import { rateLimit } from "express-rate-limit";
import { ApiResponseDto } from "../dto/apiResponse.dto";

const WINDOW_MS = 15 * 60 * 1000;

function limiter(limit: number) {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        message: "Too many requests, please try again later",
        data: null,
      } satisfies ApiResponseDto);
    },
  });
}

// Per-IP, in memory. Multi-instance deployments need a shared store (e.g. Redis).

/** Sends email, so it is the tightest. */
export const otpRateLimit = limiter(5);
/** Login, register and reset-password attempts. */
export const credentialRateLimit = limiter(20);
