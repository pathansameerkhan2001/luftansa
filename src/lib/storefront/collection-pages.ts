/**
 * Collection pages (pure, no I/O): Best Sellers, Attar and the Explore by Notes
 * families. Every membership comes from product data managed in
 * Admin → Products; nothing is assigned here.
 *
 * Note families group a product by the fragrance notes (and keywords) already
 * entered for it: a product with a "Bergamot" top note appears under Citrus.
 * The word lists below only classify note names; they never add notes to a
 * product. A product can belong to several families.
 */
import type { NoteSlug } from "@/data/note-categories";
import { sortByDisplayOrder, type CollectionCandidate } from "./collections";

export const NOTE_FAMILY_WORDS: Record<NoteSlug, readonly string[]> = {
  citrus: ["citrus", "citrusy", "bergamot", "lemon", "lime", "orange", "mandarin", "grapefruit", "neroli", "yuzu", "tangerine", "petitgrain", "citron", "kumquat", "clementine", "lemongrass"],
  woody: ["wood", "woods", "woody", "cedar", "cedarwood", "sandalwood", "vetiver", "patchouli", "guaiac", "birch", "cypress", "pine", "oakmoss", "moss", "cashmere", "cashmeran", "papyrus", "teak", "agarwood", "oud", "oudh"],
  floral: ["floral", "flower", "flowers", "rose", "jasmine", "lily", "tuberose", "iris", "orris", "violet", "peony", "lavender", "magnolia", "gardenia", "ylang", "blossom", "freesia", "lotus", "geranium", "mimosa", "heliotrope", "osmanthus", "carnation", "marigold", "champaca", "frangipani", "plumeria", "lilac", "mogra", "jasmin"],
  oud: ["oud", "oudh", "aoud", "agarwood", "agar"],
};

export interface NoteSearchable {
  keywords: readonly string[];
  notes: { top: readonly { name: string }[]; heart: readonly { name: string }[]; base: readonly { name: string }[] };
}

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z]+/)
    .filter(Boolean);

/** Note words of a product: its fragrance notes and keywords. */
function noteWords(p: NoteSearchable): Set<string> {
  const all = [...p.notes.top, ...p.notes.heart, ...p.notes.base].map((n) => n.name).concat(p.keywords);
  return new Set(all.flatMap(words));
}

export function inNoteFamily(p: NoteSearchable, family: NoteSlug): boolean {
  const have = noteWords(p);
  return NOTE_FAMILY_WORDS[family].some((w) => have.has(w));
}

/** Products of a note family, in storefront display order. */
export function selectNoteFamily<P extends NoteSearchable & CollectionCandidate>(products: readonly P[], family: NoteSlug): P[] {
  return sortByDisplayOrder(products.filter((p) => inNoteFamily(p, family)));
}

/** Attar products: product type "attar" (or an "Attar" category), in display order. */
export function selectAttar<P extends CollectionCandidate & { productTypeId?: string; category?: string }>(products: readonly P[]): P[] {
  return sortByDisplayOrder(products.filter((p) => p.productTypeId === "attar" || /\battars?\b/i.test(p.category ?? "")));
}
