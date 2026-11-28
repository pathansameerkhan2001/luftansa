/**
 * Responsive image sizes served by /media/<key>?w=<width>&q=<quality>
 * (shared by the next/image loader and the media route; no I/O, safe in the
 * browser bundle).
 *
 * Only these widths and qualities are produced, so the number of variants
 * per image (and the work and CDN cache they need) stays bounded.
 */

/** next/image's default deviceSizes + imageSizes (next.config.ts leaves them unchanged). */
export const IMAGE_WIDTHS = [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840] as const;

/** Qualities in use on the site (50, 55, 75, 80) with room either side. */
export const IMAGE_QUALITIES = [50, 55, 60, 65, 70, 75, 80, 85, 90] as const;

export const DEFAULT_IMAGE_QUALITY = 75;

/** Smallest allowed width that is at least `width` (the largest one beyond it). */
export function snapWidth(width: number): number {
  return IMAGE_WIDTHS.find((w) => w >= width) ?? IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1];
}

/** The allowed quality closest to `quality`. */
export function snapQuality(quality: number | undefined): number {
  const q = quality ?? DEFAULT_IMAGE_QUALITY;
  return IMAGE_QUALITIES.reduce((best, c) => (Math.abs(c - q) < Math.abs(best - q) ? c : best), IMAGE_QUALITIES[0]);
}

/** Extensions the media route can resize (videos and anything else are served as stored). */
export const RESIZABLE_IMAGE = /\.(jpe?g|png|webp)$/i;

export type VariantRequest = { kind: "original" } | { kind: "variant"; width: number; quality: number } | { kind: "invalid" };

/**
 * Reads ?w= / ?q= of a media request (pure). No `w`: the stored file as is.
 * Widths and qualities outside the allowed lists are rejected, so the
 * cache cannot be flooded with arbitrary sizes.
 */
export function parseVariantRequest(params: URLSearchParams): VariantRequest {
  const w = params.get("w");
  const q = params.get("q");
  if (w === null) return q === null ? { kind: "original" } : { kind: "invalid" };
  const width = Number(w);
  const quality = q === null ? DEFAULT_IMAGE_QUALITY : Number(q);
  if (!(IMAGE_WIDTHS as readonly number[]).includes(width) || !(IMAGE_QUALITIES as readonly number[]).includes(quality)) return { kind: "invalid" };
  return { kind: "variant", width, quality };
}
