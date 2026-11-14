/**
 * Product catalogue (single source of truth for product cards).
 *
 * Rules for this file:
 * - Only confirmed information goes here. Do not add invented prices, ratings,
 *   reviews or fragrance descriptions.
 * - Prices are NOT stored per product: they come from STANDARD_PRICES_INR for
 *   each confirmed size. Only list sizes that are confirmed for that product.
 * - `description` is optional; the card omits the line when it is absent.
 * - Promotional fields (`mrpInr`, `offers`) and product facts (`concentration`,
 *   `gender`) are optional and must only be set when explicitly confirmed by
 *   Luftansa. The UI shows nothing for them while they are unset. Example:
 *     mrpInr: { 100: <confirmed MRP> },
 *     offers: [{ label: "Buy 1 Get 1 Free", sizes: [50, 100] }],
 *     concentration: "<confirmed oil concentration>",
 *     gender: "Unisex",
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

/** A confirmed promotional offer. Omit `sizes` when it applies to every size. */
export interface ProductOffer {
  /** Short badge text, e.g. "Buy 1 Get 1 Free". */
  label: string;
  sizes?: readonly BottleSizeMl[];
}

export interface Product {
  slug: string;
  name: string;
  description?: string;
  /** Confirmed bottle sizes for this product, in display order. */
  sizes: readonly BottleSizeMl[];
  image?: ProductImage;
  /** Confirmed MRP per size. Shown struck through only when above the selling price. */
  mrpInr?: Partial<Record<BottleSizeMl, number>>;
  /** Confirmed promotional offers. */
  offers?: readonly ProductOffer[];
  /** Confirmed oil concentration, e.g. as printed on the label. */
  concentration?: string;
  /** Confirmed gender positioning, e.g. "Unisex". */
  gender?: string;
}

export const PRODUCTS: readonly Product[] = [
  { slug: "black-velvet", name: "Black Velvet", sizes: [30, 50, 100] },
  { slug: "downtown-tam", name: "Downtown Tam", sizes: [30, 50, 100] },
  { slug: "oud-forest", name: "Oud Forest", sizes: [30, 50, 100] },
  // Best sellers ("Find Your Personality"). Spray perfumes at confirmed standard pricing.
  { slug: "daily-rizz", name: "Daily Rizz", sizes: [30, 50, 100] },
  { slug: "nonchalant", name: "Nonchalant", sizes: [30, 50, 100] },
  { slug: "green-flag-energy", name: "Green Flag Energy", sizes: [30, 50, 100] },
  { slug: "main-character", name: "Main Character", sizes: [30, 50, 100] },
  { slug: "deja-vu", name: "Deja Vu", sizes: [30, 50, 100] },
  // Remaining signature fragrances (41 in total) to be added once confirmed.
];

/** Products featured in the homepage "Signature Fragrances" section. */
export const SIGNATURE_PRODUCT_SLUGS = ["black-velvet", "downtown-tam", "oud-forest"] as const;

/** Homepage "Best Sellers / Find Your Personality" selector, in display order. */
export const BEST_SELLER_SLUGS = [
  "daily-rizz",
  "nonchalant",
  "green-flag-energy",
  "main-character",
  "deja-vu",
] as const;

/**
 * Personality Collection membership. Source: the approved homepage design,
 * which places Black Velvet and Downtown Tam in this collection. Add further
 * slugs only once their collection is confirmed.
 */
export const PERSONALITY_COLLECTION_SLUGS = ["black-velvet", "downtown-tam"] as const;

/**
 * Roll-on perfumes (a separate format from the spray bottles above).
 *
 * Roll-ons do NOT inherit STANDARD_PRICES_INR: every variant carries its own
 * confirmed price. Only list products confirmed to exist as roll-ons, e.g.
 *   {
 *     slug: "black-velvet-roll-on",
 *     name: "Black Velvet",
 *     variants: [{ label: "8 ml", priceInr: 0 }],
 *     image: { key: "products/roll-on/black-velvet.jpg", alt: "Luftansa Black Velvet roll-on" },
 *   }
 * While this list is empty the Roll On Collection shows a "coming soon" state.
 */
export interface RollOnVariant {
  /** Display label, e.g. "8 ml". */
  label: string;
  /** Confirmed price in INR for this variant. */
  priceInr: number;
  /** Confirmed MRP, if any. */
  mrpInr?: number;
  /** Confirmed offer labels for this variant, if any. */
  offers?: readonly string[];
}

export interface RollOnProduct {
  slug: string;
  name: string;
  variants: readonly RollOnVariant[];
  image?: ProductImage;
}

export const ROLL_ON_PRODUCTS: readonly RollOnProduct[] = [];

export function getProductsBySlugs(slugs: readonly string[]): Product[] {
  return slugs
    .map((slug) => PRODUCTS.find((p) => p.slug === slug))
    .filter((p): p is Product => Boolean(p));
}

export function priceForSize(size: BottleSizeMl): number {
  return STANDARD_PRICES_INR[size];
}

/** A purchasable option (bottle size / roll-on variant) with its confirmed pricing. */
export interface ProductOption {
  id: string;
  label: string;
  priceInr: number;
  /** Confirmed MRP, only when higher than `priceInr`. */
  mrpInr?: number;
  /** Labels of confirmed offers that apply to this option. */
  offers?: readonly string[];
}

function offersFor(offers: readonly ProductOffer[] | undefined, size?: BottleSizeMl): string[] | undefined {
  const labels = (offers ?? []).filter((o) => !o.sizes || (size !== undefined && o.sizes.includes(size))).map((o) => o.label);
  return labels.length > 0 ? labels : undefined;
}

function validMrp(mrp: number | undefined, price: number): number | undefined {
  return mrp !== undefined && mrp > price ? mrp : undefined;
}

/** Spray options: confirmed sizes at standard prices, plus any configured MRP/offers. */
export function sprayOptions(product: Product): ProductOption[] {
  return product.sizes.map((ml) => {
    const priceInr = priceForSize(ml);
    return {
      id: `${ml}ml`,
      label: `${ml} ml`,
      priceInr,
      mrpInr: validMrp(product.mrpInr?.[ml], priceInr),
      offers: offersFor(product.offers, ml),
    };
  });
}

/** Roll-on options: each variant's own confirmed price (never the spray list). */
export function rollOnOptions(product: RollOnProduct): ProductOption[] {
  return product.variants.map((v) => ({
    id: v.label,
    label: v.label,
    priceInr: v.priceInr,
    mrpInr: validMrp(v.mrpInr, v.priceInr),
    offers: v.offers && v.offers.length > 0 ? v.offers : undefined,
  }));
}

/** Whole-number discount percentage, or undefined when there is no valid MRP. */
export function discountPercent(option: Pick<ProductOption, "priceInr" | "mrpInr">): number | undefined {
  if (!option.mrpInr || option.mrpInr <= option.priceInr) return undefined;
  return Math.round(((option.mrpInr - option.priceInr) / option.mrpInr) * 100);
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatInr(amount: number): string {
  return inr.format(amount);
}
