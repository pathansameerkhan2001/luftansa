/**
 * Storefront route builders: the single place that decides which URLs exist.
 *
 * A builder is `null` while its page does not exist, so components never link
 * to a route that would 404. When the product detail page is created (e.g.
 * src/app/products/[slug]/page.tsx), set:
 *   export const PRODUCT_DETAIL_ROUTE = (slug: string) => `/products/${slug}`;
 * and likewise for collections. Every "Shop Now" / "Explore Collection" link
 * then switches on automatically.
 */
import { PRODUCTS } from "@/data/products";
import type { CollectionSlug } from "@/data/reels";

type RouteBuilder = ((slug: string) => string) | null;

/** Product detail page. Not built yet. */
export const PRODUCT_DETAIL_ROUTE: RouteBuilder = null;

/** Collection listing page. Not built yet. */
export const COLLECTION_ROUTE: RouteBuilder = null;

/**
 * About Us / Our Story page. Not built yet (the header already points at
 * "/our-story"); set to that path once src/app/our-story/page.tsx exists.
 */
export const ABOUT_ROUTE: string | null = null;

const PRODUCT_SLUGS = new Set(PRODUCTS.map((p) => p.slug));

/** URL of a product's detail page, or undefined if the page or product does not exist. */
export function productHref(slug: string | undefined): string | undefined {
  if (!slug || !PRODUCT_DETAIL_ROUTE || !PRODUCT_SLUGS.has(slug)) return undefined;
  return PRODUCT_DETAIL_ROUTE(slug);
}

/** URL of a collection page, or undefined if collection pages do not exist yet. */
export function collectionHref(slug: CollectionSlug | undefined): string | undefined {
  if (!slug || !COLLECTION_ROUTE) return undefined;
  return COLLECTION_ROUTE(slug);
}

/** True when `slug` is a real catalogue product (used to validate Reel data). */
export function isCatalogueProduct(slug: string): boolean {
  return PRODUCT_SLUGS.has(slug);
}
