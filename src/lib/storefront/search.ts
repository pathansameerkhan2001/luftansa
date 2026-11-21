/**
 * Storefront product search (pure, no I/O). Every word of the query must match
 * the product's name, its format ("perfume", "roll-on"), keywords, fragrance
 * notes, category or description. Results keep the given (display) order and
 * are grouped by section by the caller.
 */
import { FORMAT_LABEL, SECTION_LABEL, type ProductFormat } from "@/lib/catalogue/product-format";

export interface SearchableProduct {
  displayName: string;
  format: ProductFormat;
  category: string;
  description?: string;
  keywords: readonly string[];
  notes: { top: readonly { name: string }[]; heart: readonly { name: string }[]; base: readonly { name: string }[] };
}

export const MAX_QUERY_LENGTH = 80;

const normalize = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Words of a query (normalized; "roll-on" and "rollon" both become "rollon"). */
export function queryWords(q: string): string[] {
  return normalize(q.slice(0, MAX_QUERY_LENGTH))
    .replace(/\broll on\b/g, "rollon")
    .split(" ")
    .filter(Boolean);
}

function haystack(p: SearchableProduct): string {
  const parts = [
    p.displayName,
    FORMAT_LABEL[p.format],
    SECTION_LABEL[p.format],
    p.format === "perfume" ? "spray perfume eau de parfum" : "",
    p.category,
    p.description ?? "",
    ...p.keywords,
    ...p.notes.top.map((n) => n.name),
    ...p.notes.heart.map((n) => n.name),
    ...p.notes.base.map((n) => n.name),
  ];
  return ` ${normalize(parts.join(" ")).replace(/\broll on\b/g, "rollon")} `;
}

export function searchProducts<T extends SearchableProduct>(products: readonly T[], q: string): T[] {
  const words = queryWords(q);
  if (words.length === 0) return [];
  return products.filter((p) => {
    const text = haystack(p);
    // Each word must start a word in the product text ("vel" finds "Velvet").
    return words.every((w) => text.includes(` ${w}`));
  });
}
