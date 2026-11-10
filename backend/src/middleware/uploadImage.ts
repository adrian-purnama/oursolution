import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ApiResponseDto } from "../dto/apiResponse.dto";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
});

/** Reads one in-memory file and answers upload problems with 400 instead of 500. */
export function uploadSingleImage(field: string) {
  const handler = upload.single(field);

  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, (error: unknown) => {
      if (!error) return next();

      const message =
        error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
          ? "Image must be 5MB or smaller"
          : "Invalid upload";

      res.status(400).json({
        success: false,
        message,
        data: null,
      } satisfies ApiResponseDto);
    });
  };
}
