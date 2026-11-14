/**
 * Instagram Reels for the homepage "Luftansa Fragrance Moments" section.
 *
 * Rules:
 * - Only genuine Luftansa Reels. `instagramUrl` is the Reel's permalink.
 * - `productSlug` must be the CONFIRMED perfume featured in the Reel and must
 *   exist in PRODUCTS (src/data/products.ts). Never guess it.
 * - Use `collectionSlug` instead when a Reel features a range rather than one
 *   confirmed perfume. Leave both unset if neither is confirmed.
 * - Thumbnails: upload to S3 under "reels/thumbnails/" and set `thumbnail.key`.
 *
 * Example:
 *   {
 *     id: "black-velvet-morning-routine",
 *     instagramUrl: "https://www.instagram.com/reel/<code>/",
 *     title: "Black Velvet morning routine",
 *     thumbnail: { key: "reels/thumbnails/black-velvet-morning.jpg", alt: "…" },
 *     productSlug: "black-velvet",
 *   }
 *
 * The section stays hidden while REELS is empty.
 */
import type { NoteSlug } from "./note-categories";

/** Collections a Reel may point to (when it features a range, not one perfume). */
export type CollectionSlug = "personality" | "roll-on" | NoteSlug;

export interface Reel {
  id: string;
  /** Permalink of the Reel on Instagram. */
  instagramUrl: string;
  /** Short accessible description, e.g. "Black Velvet morning routine". */
  title: string;
  thumbnail?: {
    /** S3 key under "reels/thumbnails/" (preferred). */
    key?: string;
    /** Absolute URL on a host allowed in next.config.ts. */
    src?: string;
    alt: string;
  };
  /** Confirmed featured perfume (slug from PRODUCTS). */
  productSlug?: string;
  /** Confirmed featured collection, used when there is no single product. */
  collectionSlug?: CollectionSlug;
}

/** Luftansa's Instagram profile URL, for "Explore More on Instagram". Unset until confirmed. */
export const INSTAGRAM_PROFILE_URL: string | undefined = undefined;

export const REELS: readonly Reel[] = [];
