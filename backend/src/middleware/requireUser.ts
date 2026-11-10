import { authenticateByToken } from "./authenticate";
import { requireAuth } from "./requireAuth";

/** Requires a valid token for an existing, unblocked user; sets req.user. */
export const requireUser = requireAuth(
  authenticateByToken,
  (req, user) => {
    req.user = user;
  },
  "Invalid token",
  "middleware/requireUser.ts",
);
