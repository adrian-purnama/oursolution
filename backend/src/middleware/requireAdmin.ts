import type { NextFunction, Request, Response } from "express";
import { ApiResponseDto } from "../dto/apiResponse.dto";

/** Use after requireUser. Lets only admins through. */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
      data: null,
    } satisfies ApiResponseDto);
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Forbidden",
      data: null,
    } satisfies ApiResponseDto);
  }

  return next();
}
