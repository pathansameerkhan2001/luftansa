/**
 * Fragrance profiles: occasion, description and scent pyramid per product slug.
 *
 * Rules:
 * - Only confirmed information. Leave a field undefined when it has not been
 *   supplied; the UI then shows a structured "coming soon" placeholder.
 * - `source` records where each profile came from so it can be audited.
 *
 * Note images are optional and come from NOTE_IMAGES (atmospheric ingredient
 * photography, Unsplash License). A note without an image shows a neutral icon.
 */
export type NoteTier = "top" | "middle" | "base";

export interface FragranceProfile {
  perfectFor?: string;
  description?: string;
  notes?: Partial<Record<NoteTier, string>>;
  /** Where this information came from (for review). */
  source?: string;
}

export const FRAGRANCE_PROFILES: Record<string, FragranceProfile> = {
  "daily-rizz": {
    perfectFor: "Daily Wear",
    description:
      "A refreshing blend of Citrus, Musk & Amber that feels clean, energetic, and effortless. Your go-to fragrance for work, college, gym, or everyday moments.",
    notes: { top: "Citrus", middle: "Musk", base: "Amber" },
    source: "Approved Best Sellers reference design (to be confirmed by Luftansa)",
  },
  // nonchalant, green-flag-energy, main-character, deja-vu: awaiting confirmed details.
};

/** Circular note thumbnails, keyed by note name (case-insensitive). */
export const NOTE_IMAGES: Record<string, { src: string; alt: string }> = {
  citrus: {
    src: "https://images.unsplash.com/photo-1606926167690-07a1edafd407?w=320&q=75&fm=jpg",
    alt: "Halved oranges with green leaves",
  },
  amber: {
    src: "https://images.unsplash.com/photo-1764061148216-f786bcc4b353?w=320&q=75&fm=jpg",
    alt: "Golden amber resin on wood bark",
  },
};

export function getNoteImage(note: string) {
  return NOTE_IMAGES[note.trim().toLowerCase()];
}
