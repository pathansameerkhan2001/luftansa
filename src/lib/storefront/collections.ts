/**
 * Homepage collection selection (pure, no I/O).
 *
 * Membership comes from product data, not hardcoded slug lists:
 * - Signature Fragrances: products whose `collections` include "signature".
 * - Personality Collection: products whose `collections` include "personality"
 *   first, followed by every other active product (the existing homepage
 *   behaviour, so newly added products always have a place on the homepage).
 * - Best Sellers: products with the `bestseller` flag.
 *
 * Within every collection, products are ordered by `displayOrder` (ascending;
 * products without one come last), then by name.
 */

export interface CollectionCandidate {
  slug: string;
  name: string;
  /** Product category (e.g. "Perfume"); used for related products. */
  category?: string;
  collections: readonly string[];
  bestseller: boolean;
  displayOrder?: number;
}

export function compareByDisplayOrder(a: CollectionCandidate, b: CollectionCandidate): number {
  const ao = a.displayOrder ?? Number.POSITIVE_INFINITY;
  const bo = b.displayOrder ?? Number.POSITIVE_INFINITY;
  if (ao !== bo) return ao < bo ? -1 : 1;
  return a.name.localeCompare(b.name);
}

export function sortByDisplayOrder<T extends CollectionCandidate>(products: readonly T[]): T[] {
  return [...products].sort(compareByDisplayOrder);
}

export function selectSignature<T extends CollectionCandidate>(products: readonly T[]): T[] {
  return sortByDisplayOrder(products.filter((p) => p.collections.includes("signature")));
}

export function selectPersonality<T extends CollectionCandidate>(products: readonly T[]): T[] {
  const sorted = sortByDisplayOrder(products);
  const members = sorted.filter((p) => p.collections.includes("personality"));
  const rest = sorted.filter((p) => !p.collections.includes("personality"));
  return [...members, ...rest];
}

export function selectBestSellers<T extends CollectionCandidate>(products: readonly T[]): T[] {
  return sortByDisplayOrder(products.filter((p) => p.bestseller));
}

/**
 * Related products for a product detail page: other products that share a
 * homepage collection (or the Best Sellers group) first, then products of the
 * same category. The current product is never included. Within each group the
 * storefront display order is kept.
 */
export function selectRelated<T extends CollectionCandidate>(products: readonly T[], current: T, limit = 4): T[] {
  const others = sortByDisplayOrder(products.filter((p) => p.slug !== current.slug));
  const sharesCollection = (p: T) =>
    p.collections.some((c) => current.collections.includes(c)) || (current.bestseller && p.bestseller);
  const sameCategory = (p: T) => Boolean(current.category) && p.category === current.category;

  const first = others.filter(sharesCollection);
  const second = others.filter((p) => !sharesCollection(p) && sameCategory(p));
  return [...first, ...second].slice(0, Math.max(0, limit));
}
