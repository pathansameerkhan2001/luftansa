/**
 * Instagram Reels are managed in Admin → Instagram Reels (CMS modules
 * "reels" and "reels-section", src/lib/cms/modules/reels.ts). Nothing about
 * individual Reels is hard-coded here any more.
 */
import type { NoteSlug } from "./note-categories";

/** Collections a page or link may point to (used by src/lib/routes.ts). */
export type CollectionSlug = "personality" | "roll-on" | NoteSlug;
