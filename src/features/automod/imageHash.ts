/**
 * Local perceptual image hashing for banned-image AutoMod.
 *
 * `sharp` handles the messy decode/resize boundary, including GIF first-frame
 * input. The returned hashes are compact enough to store and compare on the
 * message hot path without keeping image bytes.
 */

import sharp from "sharp";
import type { BannedImageHashValue } from "@/components/banned-image";

export type ImageHashes = BannedImageHashValue;

export interface ImageHashDistance {
  readonly average: number;
  readonly difference: number;
  readonly verticalDifference: number;
  readonly total: number;
}

export interface ImageMatchThreshold {
  readonly average: number;
  readonly difference: number;
  readonly verticalDifference: number;
  readonly total: number;
}

export type ImageMatchTolerance = "strict" | "balanced" | "loose";

export const IMAGE_MATCH_THRESHOLDS: Record<ImageMatchTolerance, ImageMatchThreshold> = {
  strict: { average: 6, difference: 8, verticalDifference: 8, total: 18 },
  balanced: { average: 10, difference: 12, verticalDifference: 12, total: 28 },
  loose: { average: 14, difference: 16, verticalDifference: 16, total: 38 },
};

async function grayscalePixels(input: Buffer, width: number, height: number): Promise<Uint8Array> {
  const { data } = await sharp(input, { pages: 1 })
    .rotate()
    .resize(width, height, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
}

function bitsToHex(bits: readonly number[]): string {
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    const nibble =
      ((bits[i] ?? 0) << 3) |
      ((bits[i + 1] ?? 0) << 2) |
      ((bits[i + 2] ?? 0) << 1) |
      (bits[i + 3] ?? 0);
    hex += nibble.toString(16);
  }
  return hex;
}

async function averageHash(input: Buffer): Promise<string> {
  const pixels = await grayscalePixels(input, 8, 8);
  const average = pixels.reduce((total, pixel) => total + pixel, 0) / pixels.length;
  return bitsToHex([...pixels].map((pixel) => (pixel >= average ? 1 : 0)));
}

async function differenceHash(input: Buffer): Promise<string> {
  const width = 9;
  const height = 8;
  const pixels = await grayscalePixels(input, width, height);
  const bits: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width - 1; x++) {
      bits.push(pixels[y * width + x] > pixels[y * width + x + 1] ? 1 : 0);
    }
  }
  return bitsToHex(bits);
}

async function verticalDifferenceHash(input: Buffer): Promise<string> {
  const width = 8;
  const height = 9;
  const pixels = await grayscalePixels(input, width, height);
  const bits: number[] = [];
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width; x++) {
      bits.push(pixels[y * width + x] > pixels[(y + 1) * width + x] ? 1 : 0);
    }
  }
  return bitsToHex(bits);
}

/**
 * Computes the hash set used by the banned-image detector.
 */
export async function hashImageBuffer(input: Buffer): Promise<ImageHashes> {
  const [average, difference, verticalDifference] = await Promise.all([
    averageHash(input),
    differenceHash(input),
    verticalDifferenceHash(input),
  ]);
  return { average, difference, verticalDifference };
}

function hammingHex(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  let distance = Math.abs(left.length - right.length) * 4;
  for (let i = 0; i < length; i++) {
    const a = Number.parseInt(left[i] ?? "0", 16);
    const b = Number.parseInt(right[i] ?? "0", 16);
    distance += ((a ^ b).toString(2).match(/1/g) ?? []).length;
  }
  return distance;
}

/**
 * Compares two stored hash sets using per-hash and aggregate distances.
 */
export function imageHashDistance(left: ImageHashes, right: ImageHashes): ImageHashDistance {
  const average = hammingHex(left.average, right.average);
  const difference = hammingHex(left.difference, right.difference);
  const verticalDifference = hammingHex(left.verticalDifference, right.verticalDifference);
  return {
    average,
    difference,
    verticalDifference,
    total: average + difference + verticalDifference,
  };
}

/** Returns true when all distances stay within the chosen tolerance. */
export function isImageHashMatch(
  distance: ImageHashDistance,
  tolerance: ImageMatchTolerance,
): boolean {
  const threshold = IMAGE_MATCH_THRESHOLDS[tolerance];
  return (
    distance.average <= threshold.average &&
    distance.difference <= threshold.difference &&
    distance.verticalDifference <= threshold.verticalDifference &&
    distance.total <= threshold.total
  );
}
