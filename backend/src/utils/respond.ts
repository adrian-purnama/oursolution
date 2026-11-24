import type { Response } from "express";
import type { ApiResponseDto } from "../dto/apiResponse.dto";
import { logger } from "../logger/logger";
import { userErrorStatus } from "./userError";

const logSource = "utils/respond.ts";

/** Answer with `data`. */
export function ok<T = null>(
  res: Response,
  message: string,
  data: T,
  status = 200,
) {
  return res
    .status(status)
    .json({ success: true, message, data } satisfies ApiResponseDto<T>);
}

/** Refuse the request with a message the user can act on. */
export function refuse(res: Response, status: number, message: string) {
  return res
    .status(status)
    .json({ success: false, message, data: null } satisfies ApiResponseDto);
}

/**
 * Answer a caught error. A `UserError` or plain `Error` is the user's to see:
 * its message, with its own status or `status`. Anything else is a server
 * fault: logged, and answered 500 with `fallback`.
 */
export function fail(
  res: Response,
  error: unknown,
  fallback: string,
  status = 400,
) {
  const userStatus = userErrorStatus(error, status);
  if (userStatus !== null) {
    return refuse(res, userStatus, (error as Error).message);
  }
  logger.error(
    `${fallback}: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
    logSource,
    "fail",
  );
  return refuse(res, 500, fallback);
}
