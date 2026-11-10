import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { normalizeImage } from "./image";

describe("normalizeImage", () => {
  it("re-encodes a raster image as a bounded PNG", async () => {
    const jpeg = await sharp({
      create: { width: 1200, height: 600, channels: 3, background: "#0f766e" },
    })
      .jpeg()
      .toBuffer();

    const out = await normalizeImage(jpeg);
    const meta = await sharp(out.buffer).metadata();
    assert.equal(out.contentType, "image/png");
    assert.equal(meta.format, "png");
    assert.equal(meta.width, 512);
    assert.equal(meta.height, 256);
  });

  it("rejects SVG even though it is an image", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
    );
    await assert.rejects(() => normalizeImage(svg), /must be a JPEG/);
  });

  it("rejects files that are not images", async () => {
    await assert.rejects(
      () => normalizeImage(Buffer.from("<html>not an image</html>")),
      /must be a JPEG/,
    );
  });
});
