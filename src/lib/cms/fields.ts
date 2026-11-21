/**
 * Reusable CMS payload field schemas (no I/O, no server-only imports): shared
 * by module definitions (validated on the server by the CMS service) and the
 * admin editors (the same rules run in the browser for inline messages).
 */
import { z } from "zod";
import { isAllowedAssetKey } from "@/lib/s3/asset-keys";

const IMAGE_KEY = /\.(jpe?g|png|webp)$/i;
const VIDEO_KEY = /\.(mp4|webm)$/i;

/** An object key from the Media Library, in an allowlisted folder, of the right kind. */
export function mediaKeySchema(kind: "image" | "video") {
  return z
    .string()
    .trim()
    .min(1, kind === "image" ? "Choose an image" : "Choose a video")
    .max(512)
    .refine(isAllowedAssetKey, "This file is not in an allowed media folder")
    .refine((k) => (kind === "image" ? IMAGE_KEY : VIDEO_KEY).test(k), kind === "image" ? "This file is not a JPEG, PNG or WebP image" : "This file is not an MP4 or WebM video");
}

/** Focal point in percent of the image (object-position), kept when the image is cropped. */
export const focalPointSchema = z.object({
  x: z.number().int().min(0).max(100),
  y: z.number().int().min(0).max(100),
});
export type FocalPoint = z.infer<typeof focalPointSchema>;
export const CENTER_FOCAL: FocalPoint = { x: 50, y: 50 };

/** Optional single-line text: trimmed; empty becomes "not set". */
export function optionalTextSchema(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .optional()
    .transform((v) => (v ? v : undefined));
}

/**
 * Link destinations editors may use: a site path ("/shop", "/#collection") or
 * an https:// URL. Everything else (javascript:, data:, protocol-relative
 * "//host", http://) is rejected.
 */
export function isSafeHref(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > 300 || /\s/.test(v) || v.includes("\\")) return false;
  if (v.startsWith("/")) return !v.startsWith("//");
  try {
    const url = new URL(v);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export const hrefSchema = z
  .string()
  .trim()
  .min(1, "Enter a destination")
  .max(300)
  .refine(isSafeHref, "Use a site path such as /shop, or a full https:// address");

/**
 * Optional call-to-action: both label and destination, or neither.
 * Empty fields from a form are treated as "no button".
 */
export const optionalCtaSchema = z.preprocess(
  (v) => {
    if (!v || typeof v !== "object") return undefined;
    const { label, href } = v as { label?: unknown; href?: unknown };
    const empty = (x: unknown) => x === undefined || (typeof x === "string" && x.trim() === "");
    return empty(label) && empty(href) ? undefined : v;
  },
  z
    .object({
      label: z.string().trim().min(1, "Enter the button label").max(40, "Button label must be 40 characters or fewer"),
      href: hrefSchema,
    })
    .strict()
    .optional(),
);

/** Desktop/mobile split used by every storefront section: phones are below 640px (Tailwind `sm`). */
export const MOBILE_MAX_WIDTH_PX = 639;
export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_MAX_WIDTH_PX}px)`;

/** CSS classes that apply desktop/mobile visibility. null = hidden everywhere. */
export function visibilityClassName(v: { desktop: boolean; mobile: boolean }): string | null {
  if (!v.desktop && !v.mobile) return null;
  if (!v.mobile) return "hidden sm:block";
  if (!v.desktop) return "sm:hidden";
  return "";
}

/* ---------------------------------------------- schedule date inputs --- */

const pad2 = (n: number) => String(n).padStart(2, "0");

/** ISO instant -> "YYYY-MM-DDTHH:mm" in the browser's time zone. */
export function isoToLocalInput(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "YYYY-MM-DDTHH:mm" (browser time zone) -> ISO instant, undefined when empty or invalid. */
export function localInputToIso(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
