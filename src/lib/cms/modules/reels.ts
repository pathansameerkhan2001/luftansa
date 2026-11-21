/**
 * Instagram Reels CMS modules (Phase 4), on the existing CMS foundation:
 *
 *   "reels-section"  single record: heading, supporting text, Instagram profile.
 *                    Deactivating it hides the homepage section.
 *   "reels"          list: one entry per Reel. Publishing = Active, Deactivate =
 *                    Inactive; order is the CMS display order.
 *
 * Videos and posters are Media Library keys (so the Media Library's "where
 * used" check protects them from deletion). A video may instead be an https
 * MP4/WebM URL. Nothing is hard-coded on the homepage: with no active Reels
 * (or a deactivated section, or a database problem) the section is hidden.
 */
import { z } from "zod";
import type { CmsModuleDefinition } from "../schemas";
import { mediaKeySchema, optionalTextSchema } from "../fields";
import { idSchema } from "@/lib/db/schemas";

export const MAX_REELS = 24;

/* ------------------------------------------------------------ validation --- */

const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com"]);

/** A Reel or post permalink: https://www.instagram.com/reel/<code>/ (also /reels/, /p/, /tv/). */
export function isInstagramReelUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" && INSTAGRAM_HOSTS.has(u.hostname) && /^\/(reel|reels|p|tv)\/[A-Za-z0-9_-]{5,64}\/?$/.test(u.pathname) && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** An Instagram profile: https://www.instagram.com/<username>/ */
export function isInstagramProfileUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" && INSTAGRAM_HOSTS.has(u.hostname) && /^\/[A-Za-z0-9._]{1,30}\/?$/.test(u.pathname) && !/^\/(reel|reels|p|tv|explore|accounts)\/?$/.test(u.pathname);
  } catch {
    return false;
  }
}

/** A directly playable video file on a public https host (MP4 or WebM). */
export function isSafeVideoUrl(value: string): boolean {
  if (value.length > 500 || /\s/.test(value)) return false;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password) return false;
    if (/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[)/.test(u.hostname) || !u.hostname.includes(".")) return false;
    return /\.(mp4|webm)$/i.test(u.pathname);
  } catch {
    return false;
  }
}

const reelUrlSchema = z.string().trim().max(300).refine(isInstagramReelUrl, "Use the Reel's Instagram link, for example https://www.instagram.com/reel/ABC123xyz/");

export const reelVideoSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("upload"), key: mediaKeySchema("video") }).strict(),
  z.object({ source: z.literal("url"), url: z.string().trim().refine(isSafeVideoUrl, "Use an https link to an MP4 or WebM video file") }).strict(),
]);

export const reelPayloadSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a title").max(80, "Title must be 80 characters or fewer"),
    caption: optionalTextSchema(200, "Caption"),
    fragranceName: optionalTextSchema(80, "Fragrance name"),
    video: reelVideoSchema,
    poster: z
      .object({
        key: mediaKeySchema("image"),
        alt: z.string().trim().min(1, "Describe the poster image for screen readers").max(200, "Alt text must be 200 characters or fewer"),
      })
      .strict(),
    instagramUrl: reelUrlSchema,
    /** Optional linked product (its web address); shown only while the product is active. */
    productId: idSchema.optional(),
  })
  .strict();
export type ReelPayload = z.infer<typeof reelPayloadSchema>;
export type ReelPayloadInput = z.input<typeof reelPayloadSchema>;

export const reelsSectionPayloadSchema = z
  .object({
    heading: z.string().trim().min(1, "Enter a heading").max(80, "Heading must be 80 characters or fewer"),
    subtitle: optionalTextSchema(240, "Supporting text"),
    instagramProfileUrl: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().trim().refine(isInstagramProfileUrl, "Use your Instagram profile link, for example https://www.instagram.com/luftansa/").optional(),
    ),
  })
  .strict();
export type ReelsSectionPayload = z.infer<typeof reelsSectionPayloadSchema>;

export const REELS_SECTION_MODULE = {
  id: "reels-section",
  label: "Instagram Reels section",
  kind: "singleton",
  payload: reelsSectionPayloadSchema as unknown as z.ZodType<Record<string, unknown>>,
} as const satisfies CmsModuleDefinition;

export const REELS_MODULE = {
  id: "reels",
  label: "Instagram Reels",
  kind: "list",
  maxEntries: MAX_REELS,
  payload: reelPayloadSchema as unknown as z.ZodType<Record<string, unknown>>,
} as const satisfies CmsModuleDefinition;

/** Section text until the admin saves their own. */
export const REELS_SECTION_DEFAULT: ReelsSectionPayload = {
  heading: "Luftansa Fragrance Moments",
  subtitle: "Reels, routines and real reviews from our Luftansa family.",
};

/* ------------------------------------------------------------ rendering --- */

export interface ReelView {
  id: string;
  title: string;
  caption?: string;
  fragranceName?: string;
  videoSrc: string;
  poster: { src: string; alt: string };
  instagramUrl: string;
  /** Present only when the linked product is active on the storefront. */
  product?: { href: string; name: string };
}

export interface ReelsSectionView {
  heading: string;
  subtitle?: string;
  instagramProfileUrl?: string;
  reels: ReelView[];
}

interface PublishedLike<T> {
  source: "cms" | "fallback";
  items: readonly { id: string; payload: T }[];
}

/**
 * What the homepage shows (pure). null = hide the section:
 * - the section was deactivated (published once, now inactive),
 * - no Reel is active (or every active Reel's stored content is invalid),
 * - the Reels could not be loaded (fallback source has no items).
 */
export function resolveReelsSection(
  section: PublishedLike<unknown>,
  reels: PublishedLike<unknown>,
  toUrl: (key: string) => string,
  activeProducts: ReadonlyMap<string, { href: string; name: string }>,
): ReelsSectionView | null {
  // Section record: published → use it; never published → defaults; deactivated → hidden.
  let sectionPayload: ReelsSectionPayload = REELS_SECTION_DEFAULT;
  if (section.source === "cms") {
    const item = section.items[0];
    if (!item) return null; // deactivated by the admin
    const parsed = reelsSectionPayloadSchema.safeParse(item.payload);
    if (parsed.success) sectionPayload = parsed.data; // invalid stored text: keep the default wording
  }

  const views: ReelView[] = [];
  for (const item of reels.items) {
    const parsed = reelPayloadSchema.safeParse(item.payload);
    if (!parsed.success) continue;
    const r = parsed.data;
    views.push({
      id: item.id,
      title: r.title,
      caption: r.caption,
      fragranceName: r.fragranceName,
      videoSrc: r.video.source === "upload" ? toUrl(r.video.key) : r.video.url,
      poster: { src: toUrl(r.poster.key), alt: r.poster.alt },
      instagramUrl: r.instagramUrl.trim(),
      product: r.productId ? activeProducts.get(r.productId) : undefined,
    });
  }
  if (views.length === 0) return null;
  return { heading: sectionPayload.heading, subtitle: sectionPayload.subtitle, instagramProfileUrl: sectionPayload.instagramProfileUrl, reels: views };
}
