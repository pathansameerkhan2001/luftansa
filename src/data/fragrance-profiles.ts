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

/**
 * Note photography (Unsplash License), keyed by note name (case-insensitive).
 * Used for a note that has no photo uploaded in Admin → Products; a note with
 * neither shows a neutral monogram circle.
 */
export const NOTE_IMAGES: Record<string, { src: string; alt: string }> = {
  citrus: { src: "https://images.unsplash.com/photo-1606926167690-07a1edafd407?w=320&q=75&fm=jpg", alt: "Halved oranges with green leaves" },
  amber: { src: "https://images.unsplash.com/photo-1764061148216-f786bcc4b353?w=320&q=75&fm=jpg", alt: "Golden amber resin on wood bark" },
  pineapple: { src: "https://images.unsplash.com/photo-1788033530490-208a77c2c251?w=320&q=75&fm=jpg&fit=crop", alt: "Whole pineapple with its green crown" },
  birch: { src: "https://images.unsplash.com/photo-1781584648187-c7513fd1aa9b?w=320&q=75&fm=jpg&fit=crop", alt: "White birch tree trunks with textured bark" },
  lemon: { src: "https://images.unsplash.com/photo-1610126176343-3e1833a107e1?w=320&q=75&fm=jpg&fit=crop", alt: "Overlapping slices of fresh lemon" },
  mandarin: { src: "https://images.unsplash.com/photo-1770678817191-c3f8d0c52496?w=320&q=75&fm=jpg&fit=crop", alt: "Ripe mandarins with green leaves" },
  grapefruit: { src: "https://images.unsplash.com/photo-1769508854136-3a600db4c2e0?w=320&q=75&fm=jpg&fit=crop", alt: "Half a ripe pink grapefruit" },
  lavender: { src: "https://images.unsplash.com/photo-1528756514091-dee5ecaa3278?w=320&q=75&fm=jpg&fit=crop", alt: "Close-up of lavender flowers" },
  rose: { src: "https://images.unsplash.com/photo-1597826368522-9f4cb5a6ba48?w=320&q=75&fm=jpg&fit=crop", alt: "Close-up of a pink rose" },
  jasmine: { src: "https://images.unsplash.com/photo-1781707533179-9c296c975a04?w=320&q=75&fm=jpg&fit=crop", alt: "White jasmine flowers" },
  sandalwood: { src: "https://images.unsplash.com/photo-1736506159893-22cca29b8018?w=320&q=75&fm=jpg&fit=crop", alt: "Close-up of dark wood grain" },
  cedarwood: { src: "https://images.unsplash.com/photo-1636396279546-2294149dc46e?w=320&q=75&fm=jpg&fit=crop", alt: "Pieces of wood in a glass bowl" },
  apple: { src: "https://images.unsplash.com/photo-1630563451961-ac2ff27616ab?w=320&q=75&fm=jpg&fit=crop", alt: "A red apple" },
  "black pepper": { src: "https://images.unsplash.com/photo-1759393098862-f2e98983e2f1?w=320&q=75&fm=jpg&fit=crop", alt: "A single black peppercorn" },
  cardamom: { src: "https://images.unsplash.com/photo-1758657996330-095d08451cd9?w=320&q=75&fm=jpg&fit=crop", alt: "Dried cardamom pods" },
  mint: { src: "https://images.unsplash.com/photo-1788440890059-0aba82658d9a?w=320&q=75&fm=jpg&fit=crop", alt: "Fresh mint leaves" },
  coffee: { src: "https://images.unsplash.com/photo-1783926014847-748a8074eb38?w=320&q=75&fm=jpg&fit=crop", alt: "Dark roasted coffee beans" },
  cinnamon: { src: "https://images.unsplash.com/photo-1758657996518-e67bd328854e?w=320&q=75&fm=jpg&fit=crop", alt: "Cinnamon sticks" },
  saffron: { src: "https://images.unsplash.com/photo-1760982685843-17fdca1c1bc9?w=320&q=75&fm=jpg&fit=crop", alt: "Saffron flowers with red stigmas" },
  peach: { src: "https://images.unsplash.com/photo-1642372849486-f88b963cb734?w=320&q=75&fm=jpg&fit=crop", alt: "Ripe peaches, one halved" },
  leather: { src: "https://images.unsplash.com/photo-1571829604981-ea159f94e5ad?w=320&q=75&fm=jpg&fit=crop", alt: "Close-up of brown leather" },
  tobacco: { src: "https://images.unsplash.com/photo-1758414083945-798d80875767?w=320&q=75&fm=jpg&fit=crop", alt: "Close-up of tobacco leaves" },
  ginger: { src: "https://images.unsplash.com/photo-1741517802684-ba07c444a5d2?w=320&q=75&fm=jpg&fit=crop", alt: "Fresh ginger root" },
  coconut: { src: "https://images.unsplash.com/photo-1560769680-ba2f3767c785?w=320&q=75&fm=jpg&fit=crop", alt: "Halved coconuts" },
};

/** Other names of the same ingredient. */
const NOTE_ALIASES: Record<string, string> = {
  "orange": "mandarin",
  "tangerine": "mandarin",
  "mandarin orange": "mandarin",
  "sweet orange": "mandarin",
  "pink grapefruit": "grapefruit",
  "cedar": "cedarwood",
  "green apple": "apple",
  "red apple": "apple",
  "pepper": "black pepper",
  "peppermint": "mint",
  "spearmint": "mint",
  "coffee bean": "coffee",
  "coffee beans": "coffee",
  "tobacco leaf": "tobacco",
};

export function getNoteImage(note: string) {
  const key = note.trim().toLowerCase().replace(/\s+/g, " ");
  return NOTE_IMAGES[key] ?? NOTE_IMAGES[NOTE_ALIASES[key] ?? ""];
}
