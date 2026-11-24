import sharp from "sharp";
import { UserError } from "./userError";

/** Largest photo a ticket message may carry, before processing. */
export const MAX_TICKET_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 2000;
const MAX_INPUT_PIXELS = 40_000_000;
const WEBP_QUALITY = 85;

type Format = "jpeg" | "png" | "webp";

export class TicketImageError extends UserError {}

/** The format the file's first bytes say it is; null for anything else. */
export function sniffImage(buffer: Buffer): Format | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("latin1", 0, 4) === "RIFF" &&
    buffer.toString("latin1", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

/**
 * Checks a ticket photo by its bytes (never its name or content type) and
 * re-encodes it as WebP: at most 2000 px a side, no metadata, nothing but
 * pixels left of what was sent.
 */
export async function processTicketImage(
  input: Buffer,
): Promise<{ buffer: Buffer; contentType: "image/webp" }> {
  if (input.length > MAX_TICKET_IMAGE_BYTES) {
    throw new TicketImageError("The photo must be 2 MB or smaller");
  }
  const sniffed = sniffImage(input);
  if (!sniffed) {
    throw new TicketImageError("The photo must be a JPEG, PNG or WebP image");
  }
  try {
    const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS });
    const { format } = await image.metadata();
    if (format !== sniffed) throw new Error("format mismatch");
    const buffer = await image
      .rotate()
      .resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    return { buffer, contentType: "image/webp" };
  } catch {
    throw new TicketImageError("The photo could not be read as an image");
  }
}
