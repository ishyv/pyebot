import { describe, expect, it } from "bun:test";
import sharp from "sharp";
import { hashImageBuffer, imageHashDistance, isImageHashMatch } from "./imageHash";

async function gradientPng(size: number): Promise<Buffer> {
  const pixels = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 3;
      pixels[offset] = Math.round((x / (size - 1)) * 255);
      pixels[offset + 1] = Math.round((y / (size - 1)) * 255);
      pixels[offset + 2] = 96;
    }
  }
  return sharp(pixels, { raw: { width: size, height: size, channels: 3 } })
    .png()
    .toBuffer();
}

describe("image hashing", () => {
  it("matches resized and re-encoded versions of the same image", async () => {
    const original = await gradientPng(64);
    const reencoded = await sharp(original).resize(96, 96).jpeg({ quality: 80 }).toBuffer();

    const distance = imageHashDistance(
      await hashImageBuffer(original),
      await hashImageBuffer(reencoded),
    );

    expect(isImageHashMatch(distance, "balanced")).toBe(true);
  });

  it("decodes the first frame of a GIF without crashing", async () => {
    const gif = await sharp(await gradientPng(32))
      .gif()
      .toBuffer();

    const hashes = await hashImageBuffer(gif);

    expect(hashes.average).toHaveLength(16);
    expect(hashes.difference).toHaveLength(16);
    expect(hashes.verticalDifference).toHaveLength(16);
  });
});
