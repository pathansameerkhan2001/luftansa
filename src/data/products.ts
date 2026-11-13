/**
 * Product catalogue (single source of truth for product cards).
 *
 * Rules for this file:
 * - Only confirmed information goes here. Do not add invented prices, ratings,
 *   reviews or fragrance descriptions.
 * - Prices are NOT stored per product: they come from STANDARD_PRICES_INR for
 *   each confirmed size. Only list sizes that are confirmed for that product.
 * - `description` is optional; the card omits the line when it is absent.
 * - `image` is optional; until genuine photography is uploaded to S3 the card
 *   shows a neutral placeholder. Set e.g.
 *     image: { key: "products/black-velvet.jpg", alt: "Luftansa Black Velvet bottle" }
 */

export const BOTTLE_SIZES_ML = [30, 50, 100] as const;
export type BottleSizeMl = (typeof BOTTLE_SIZES_ML)[number];

/** Confirmed standard Luftansa pricing (INR) by bottle size. */
export const STANDARD_PRICES_INR: Record<BottleSizeMl, number> = {
  30: 400,
  50: 630,
  100: 1000,
};

export interface ProductImage {
  /** S3 object key inside the private bucket (e.g. "products/oud-forest.jpg"). */
  key: string;
  alt: string;
  objectPosition?: string;
}

export interface Product {
  slug: string;
  name: string;
  description?: string;
  /** Confirmed bottle sizes for this product, in display order. */
  sizes: readonly BottleSizeMl[];
  image?: ProductImage;
}

export const PRODUCTS: readonly Product[] = [
  { slug: "black-velvet", name: "Black Velvet", sizes: [30, 50, 100] },
  { slug: "downtown-tam", name: "Downtown Tam", sizes: [30, 50, 100] },
  { slug: "oud-forest", name: "Oud Forest", sizes: [30, 50, 100] },
  // Remaining signature fragrances (41 in total) to be added once confirmed.
];

/** Products featured in the homepage "Signature Fragrances" section. */
export const SIGNATURE_PRODUCT_SLUGS = ["black-velvet", "downtown-tam", "oud-forest"] as const;

export function getProductsBySlugs(slugs: readonly string[]): Product[] {
  return slugs
    .map((slug) => PRODUCTS.find((p) => p.slug === slug))
    .filter((p): p is Product => Boolean(p));
}

export function priceForSize(size: BottleSizeMl): number {
  return STANDARD_PRICES_INR[size];
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatInr(amount: number): string {
  return inr.format(amount);
}
