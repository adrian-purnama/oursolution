import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ApiResponseDto } from "../dto/apiResponse.dto";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Reads one in-memory file and answers upload problems with 400 instead of 500. */
export function uploadSingleImage(
  field: string,
  maxBytes: number = MAX_FILE_BYTES,
) {
  const handler = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1 },
  }).single(field);

  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, (error: unknown) => {
      if (!error) return next();

      const message =
        error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
          ? `Image must be ${Math.round(maxBytes / 1024 / 1024)}MB or smaller`
          : "Invalid upload";

      res.status(400).json({
        success: false,
        message,
        data: null,
      } satisfies ApiResponseDto);
    });
  };
}
