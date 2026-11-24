/**
 * Product photograph fitting (pure, no DOM): decides how a product photo sits
 * in its frame so the bottle is prominent without being cropped or distorted.
 *
 * Photos come from the admin in any shape and style, so one universal
 * object-fit does not work. Each photo is measured in the browser once
 * (ratio, background, where the product is) and then placed by `decideFit`:
 *
 *   isolated  The product is on a plain background (white, a flat colour, or
 *             transparent). The whole photo is contained, then zoomed so the
 *             product itself fills `fill` of the frame (capped at `maxZoom`, so
 *             it never looks artificially enlarged or pixelated). Nothing of
 *             the product is cut, only empty background. Near-white
 *             backgrounds blend into the frame (multiply); other flat colours
 *             tint the frame to match.
 *   cover     A scene photograph whose shape is close to the frame: it fills
 *             the frame, trimming at most `coverTolerance` of one dimension
 *             (background only, at the edges).
 *   contain   A scene photograph of a quite different shape: shown whole; the
 *             frame takes the photo's edge colour so the bands look intended.
 */

export interface PixelAnalysis {
  /** Border is (mostly) one flat colour or transparent. */
  plain: boolean;
  /** Border pixels are mostly transparent (a cut-out PNG/WebP). */
  transparent: boolean;
  /** Average border colour (rgb 0-255). */
  background: readonly [number, number, number];
  /** Product bounding box in fractions of the image (only when plain). */
  bbox?: { x: number; y: number; w: number; h: number };
}

export interface FitAnalysis extends Partial<PixelAnalysis> {
  /** Natural width / height of the photo. */
  ratio: number;
}

export interface FitOptions {
  /** Share of the frame the product should occupy in isolated mode (0-1). */
  fill: number;
  /** Largest zoom applied to an isolated product. */
  maxZoom: number;
  /** Largest share of one dimension `cover` may trim. */
  coverTolerance: number;
}

export const FIT_PRESETS = {
  /** Product cards (listings, search, related, collections). A square photo fills a 4:5 card (10% trimmed each side). */
  card: { fill: 0.8, maxZoom: 2.2, coverTolerance: 0.25 },
  /** Product page main photograph. */
  gallery: { fill: 0.84, maxZoom: 2, coverTolerance: 0.25 },
  /** Small thumbnails. */
  thumb: { fill: 0.9, maxZoom: 2.4, coverTolerance: 0.3 },
  /** Best Sellers showcase (square stage). */
  showcase: { fill: 0.78, maxZoom: 2, coverTolerance: 0.25 },
} as const satisfies Record<string, FitOptions>;

export type FitPreset = keyof typeof FIT_PRESETS;

export interface FitDecision {
  mode: "isolated" | "cover" | "contain";
  /** Zoom of the contained photo (isolated mode), 1 otherwise. */
  zoom: number;
  /** Translation in percent of the frame (applied before the zoom, around the centre). */
  translateX: number;
  translateY: number;
  /** Blend a near-white background into the frame. */
  blend: boolean;
  /** Frame colour to use (css), or undefined to keep the frame's own background. */
  frameColor?: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d || 0; // "|| 0" turns -0 into 0
const rgb = ([r, g, b]: readonly [number, number, number]) => `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;

/** A background light enough to disappear with mix-blend-multiply on the ivory/cream frame. */
export function isNearWhite([r, g, b]: readonly [number, number, number]): boolean {
  return Math.min(r, g, b) >= 238 && Math.max(r, g, b) - Math.min(r, g, b) <= 14;
}

/** Share of one dimension that object-fit: cover trims for this photo/frame pair (0 = none). */
export function coverCrop(imageRatio: number, frameRatio: number): number {
  if (!(imageRatio > 0) || !(frameRatio > 0)) return 1;
  return 1 - Math.min(imageRatio / frameRatio, frameRatio / imageRatio);
}

export const SAFE_DECISION: FitDecision = { mode: "contain", zoom: 1, translateX: 0, translateY: 0, blend: false };

export function decideFit(a: FitAnalysis, frameRatio: number, opts: FitOptions): FitDecision {
  const r = a.ratio;
  if (!(r > 0) || !(frameRatio > 0)) return SAFE_DECISION;

  if (a.plain && a.bbox && a.bbox.w > 0 && a.bbox.h > 0) {
    // Frame in units: width F, height 1. Contained photo size inside it.
    const F = frameRatio;
    const iw = r > F ? F : r;
    const ih = r > F ? F / r : 1;
    const bw = a.bbox.w * iw;
    const bh = a.bbox.h * ih;
    const zoom = clamp(Math.min((opts.fill * F) / bw, opts.fill / bh), 1, opts.maxZoom);
    // Product centre in frame units, then the translation that re-centres it after zooming.
    const cx = (F - iw) / 2 + (a.bbox.x + a.bbox.w / 2) * iw;
    const cy = (1 - ih) / 2 + (a.bbox.y + a.bbox.h / 2) * ih;
    // Centre the product. With a plain background, any edge this reveals shows
    // the matching frame colour, so the shift is never visible as a gap.
    const translateX = (-zoom * (cx - F / 2) * 100) / F;
    const translateY = -zoom * (cy - 0.5) * 100;
    const bg = a.background ?? [255, 255, 255];
    const blend = !a.transparent && isNearWhite(bg);
    return {
      mode: "isolated",
      zoom: round(zoom, 3),
      translateX: round(translateX),
      translateY: round(translateY),
      blend,
      frameColor: a.transparent || blend ? undefined : rgb(bg),
    };
  }

  if (coverCrop(r, frameRatio) <= opts.coverTolerance) {
    return { mode: "cover", zoom: 1, translateX: 0, translateY: 0, blend: false };
  }
  return { ...SAFE_DECISION, frameColor: a.background ? rgb(a.background) : undefined };
}

/**
 * Reads a small RGBA rendering of the photo (e.g. 96 px on the long edge):
 * is the border a flat colour or transparent, and where is the product?
 */
export function analysePixels(data: ArrayLike<number>, width: number, height: number): PixelAnalysis {
  const px = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]] as const;
  };
  const ring = Math.max(1, Math.round(Math.min(width, height) * 0.03));
  const border: (readonly [number, number, number, number])[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < ring || y < ring || x >= width - ring || y >= height - ring) border.push(px(x, y));
    }
  }
  const transparentShare = border.filter((p) => p[3] < 24).length / Math.max(1, border.length);
  const transparent = transparentShare >= 0.85;
  const opaque = border.filter((p) => p[3] >= 24);
  const sum = opaque.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]);
  const n = Math.max(1, opaque.length);
  const background = [sum[0] / n, sum[1] / n, sum[2] / n] as const;
  const near = (p: readonly number[], tol: number) => Math.abs(p[0] - background[0]) + Math.abs(p[1] - background[1]) + Math.abs(p[2] - background[2]) <= tol * 3;
  const flatShare = opaque.filter((p) => near(p, 14)).length / n;
  const plain = transparent || (opaque.length > 0 && flatShare >= 0.9);
  if (!plain) return { plain, transparent, background };

  // Product = pixels that are not background. Rows/columns need a couple of hits (ignores dust/noise).
  const isProduct = (p: readonly number[]) => (transparent ? p[3] >= 40 : p[3] >= 40 && !near(p, 26));
  const cols = new Array<number>(width).fill(0);
  const rows = new Array<number>(height).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isProduct(px(x, y))) {
        cols[x]++;
        rows[y]++;
      }
    }
  }
  const minHits = 2;
  const first = (a: number[]) => a.findIndex((c) => c >= minHits);
  const last = (a: number[]) => a.length - 1 - [...a].reverse().findIndex((c) => c >= minHits);
  const x0 = first(cols);
  const y0 = first(rows);
  if (x0 < 0 || y0 < 0) return { plain, transparent, background };
  const x1 = last(cols);
  const y1 = last(rows);
  const bbox = { x: x0 / width, y: y0 / height, w: (x1 - x0 + 1) / width, h: (y1 - y0 + 1) / height };
  // A "product" covering nearly the whole photo means the border test was misleading: treat as a scene.
  if (bbox.w * bbox.h > 0.92) return { plain: false, transparent, background };
  return { plain, transparent, background, bbox };
}

/**
 * Scales every length in a `sizes` attribute ("(min-width: 1024px) 300px, 90vw")
 * so a zoomed photo is requested at a resolution that stays sharp. Media
 * conditions are left untouched.
 */
export function scaleSizes(sizes: string, factor: number): string {
  if (!(factor > 1)) return sizes;
  return sizes
    .split(",")
    .map((part) => part.replace(/(\s|^)(\d+(?:\.\d+)?)(px|vw)\s*$/, (_, pre: string, n: string, unit: string) => `${pre}${Math.round(Number(n) * factor)}${unit}`))
    .join(",");
}
