/**
 * Browser-side image compression for admin uploads.
 *
 * - Files already within the limit are uploaded untouched (original quality).
 * - Larger files are re-encoded at high quality first, at full resolution
 *   (capped at 4096 px on the longest edge), and only scaled down step by step
 *   if high-quality encoding alone does not fit.
 * - JPEG stays JPEG. PNG/WebP become WebP (keeps transparency), or JPEG when
 *   the browser cannot encode WebP.
 * - If nothing fits, an ImageCompressionError with a clear message is thrown.
 */
import { formatMegabytes, MAX_UPLOAD_BYTES } from "./upload-limits";

export class ImageCompressionError extends Error {}

export type EncodeFn = (width: number, height: number, type: string, quality: number) => Promise<Blob>;

export interface CompressionPlanOptions {
  limitBytes?: number;
  /** Longest edge cap for the first attempt. */
  maxEdge?: number;
  /** Do not scale below this longest edge (keeps product photos sharp). */
  minEdge?: number;
  qualities?: readonly number[];
  scaleStep?: number;
}

const DEFAULTS = {
  maxEdge: 4096,
  minEdge: 1200,
  qualities: [0.92, 0.88, 0.84, 0.8] as readonly number[],
  scaleStep: 0.85,
};

/** Width/height scaled so the longest edge is at most `maxEdge`. */
export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const ratio = maxEdge / longest;
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

/**
 * Core search loop (pure apart from `encode`): highest quality and resolution
 * first, returning the first encoding that fits within the limit.
 */
export async function findEncodingWithinLimit(
  source: { width: number; height: number },
  preferredType: string,
  encode: EncodeFn,
  options: CompressionPlanOptions = {},
): Promise<{ blob: Blob; width: number; height: number; quality: number }> {
  const limit = options.limitBytes ?? MAX_UPLOAD_BYTES;
  const qualities = options.qualities ?? DEFAULTS.qualities;
  const minEdge = options.minEdge ?? DEFAULTS.minEdge;
  const step = options.scaleStep ?? DEFAULTS.scaleStep;
  let type = preferredType;
  let edge = Math.min(Math.max(source.width, source.height), options.maxEdge ?? DEFAULTS.maxEdge);
  let smallest = Number.POSITIVE_INFINITY;

  for (;;) {
    const { width, height } = fitWithin(source.width, source.height, edge);
    for (const quality of qualities) {
      const blob = await encode(width, height, type, quality);
      // Browsers without WebP encoding silently return PNG: switch to JPEG.
      if (blob.type && blob.type !== type) {
        type = "image/jpeg";
        const retry = await encode(width, height, type, quality);
        smallest = Math.min(smallest, retry.size);
        if (retry.size <= limit) return { blob: retry, width, height, quality };
        continue;
      }
      smallest = Math.min(smallest, blob.size);
      if (blob.size <= limit) return { blob, width, height, quality };
    }
    if (edge <= minEdge) break;
    edge = Math.max(minEdge, Math.round(edge * step));
  }

  throw new ImageCompressionError(
    `This image could not be reduced below ${formatMegabytes(limit)} without visible quality loss ` +
      `(smallest attempt: ${formatMegabytes(smallest)}). Please export it at a lower resolution and try again.`,
  );
}

function outputTypeFor(inputType: string): string {
  return inputType === "image/jpeg" ? "image/jpeg" : "image/webp";
}

function renamed(name: string, type: string): string {
  const ext = type === "image/jpeg" ? "jpg" : type === "image/webp" ? "webp" : "png";
  const base = name.replace(/\.[^.]+$/, "") || "image";
  return `${base}.${ext}`;
}

/**
 * Returns the original file when it already fits, otherwise a compressed copy
 * no larger than `limitBytes`. Browser only (uses createImageBitmap + canvas).
 */
export async function compressImageForUpload(file: File, limitBytes = MAX_UPLOAD_BYTES): Promise<File> {
  if (file.size <= limitBytes) return file;

  let bitmap: ImageBitmap;
  try {
    // Respects EXIF orientation so phone photos are not rotated.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageCompressionError("This image could not be read by the browser. Please re-export it as JPEG, PNG or WebP.");
  }

  try {
    const canvas = document.createElement("canvas");
    const encode: EncodeFn = (width, height, type, quality) =>
      new Promise((resolve, reject) => {
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new ImageCompressionError("Image compression is not supported in this browser."));
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(bitmap, 0, 0, width, height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new ImageCompressionError("Image compression failed in this browser."))),
          type,
          quality,
        );
      });

    const { blob } = await findEncodingWithinLimit(
      { width: bitmap.width, height: bitmap.height },
      outputTypeFor(file.type),
      encode,
      { limitBytes },
    );
    return new File([blob], renamed(file.name, blob.type), { type: blob.type, lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}
