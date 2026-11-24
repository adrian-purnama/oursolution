/**
 * A refusal meant for the person who made the request: its message is shown
 * to them as is, with this HTTP status. Domain errors extend it to fix their
 * status in one place.
 *
 * A plain `Error` is treated the same way with the controller's default
 * status (400), so `throw new Error("...")` in a service still reaches the
 * user. Anything else (database, network, library errors) is a server fault:
 * logged, and answered with a generic 500.
 */
export class UserError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * The status to answer `error` with, or null when it is a server fault whose
 * message must not reach the user.
 */
export function userErrorStatus(
  error: unknown,
  defaultStatus = 400,
): number | null {
  if (error instanceof UserError) return error.status;
  if (
    error instanceof Error &&
    Object.getPrototypeOf(error) === Error.prototype &&
    // Node system errors (ENOENT, ECONNREFUSED, ...) are plain Errors too.
    !("code" in error)
  ) {
    return defaultStatus;
  }
  return null;
}
