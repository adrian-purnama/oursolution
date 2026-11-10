import sharp from "sharp";

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "gif", "avif"]);
const MAX_DIMENSION = 512;
const MAX_INPUT_PIXELS = 40_000_000;

export type NormalizedImage = {
  buffer: Buffer;
  contentType: "image/png";
};

/**
 * Decodes an uploaded raster image and re-encodes it as a bounded PNG. The
 * format is detected from the bytes, never from the client's content type.
 */
export async function normalizeImage(input: Buffer): Promise<NormalizedImage> {
  try {
    const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS });
    const { format } = await image.metadata();

    if (!format || !ALLOWED_FORMATS.has(format)) {
      throw new Error("unsupported format");
    }

    const buffer = await image
      .rotate()
      .resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();

    return { buffer, contentType: "image/png" };
  } catch {
    throw new Error("File must be a JPEG, PNG, WebP, GIF or AVIF image");
  }
}
