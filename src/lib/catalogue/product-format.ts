/**
 * Product formats: the single rule that separates the two product sections,
 * shared by the storefront, the admin and the Excel import (pure, no I/O).
 *
 *   Perfume  productTypeId "perfume-spray", or no type (every product created
 *            before product types existed is a spray perfume). Sizes 30/50/100 ml.
 *   Roll-On  productTypeId "roll-on". Its own product records, default 8 ml.
 *   Other    any other product type (e.g. Attar): in neither section.
 *
 * A fragrance can exist as both a Perfume and a Roll-On: they are separate
 * products with their own web address, SKUs, prices, stock, images and status.
 */
export type ProductFormat = "perfume" | "roll-on" | "other";

export const PERFUME_TYPE_ID = "perfume-spray";
export const ROLL_ON_TYPE_ID = "roll-on";

export const PERFUME_SIZES_ML = [30, 50, 100] as const;
export const DEFAULT_ROLL_ON_SIZE_ML = 8;

export function productFormat(productTypeId: string | null | undefined): ProductFormat {
  if (!productTypeId || productTypeId === PERFUME_TYPE_ID) return "perfume";
  if (productTypeId === ROLL_ON_TYPE_ID) return "roll-on";
  return "other";
}

export const isRollOn = (p: { productTypeId?: string | null }) => productFormat(p.productTypeId) === "roll-on";
export const isPerfume = (p: { productTypeId?: string | null }) => productFormat(p.productTypeId) === "perfume";

/** Singular label (badges, product page eyebrow). */
export const FORMAT_LABEL: Record<ProductFormat, string> = { perfume: "Perfume", "roll-on": "Roll-On", other: "Other" };
/** Section label (navigation, listings, admin tabs). */
export const SECTION_LABEL: Record<ProductFormat, string> = { perfume: "Perfumes", "roll-on": "Roll-On", other: "Other products" };
/** Storefront listing page of each section. */
export const SECTION_ROUTE: Record<Exclude<ProductFormat, "other">, string> = { perfume: "/perfumes", "roll-on": "/roll-on" };

/**
 * Customer-facing name. A Roll-On usually shares its fragrance name with the
 * Perfume ("Black Velvet"), so the storefront says "Black Velvet Roll-On"
 * wherever both could appear (cards, search, product page, WhatsApp order).
 */
export function displayName(name: string, productTypeId: string | null | undefined): string {
  if (productFormat(productTypeId) !== "roll-on" || /roll[\s-]?on/i.test(name)) return name;
  return `${name} Roll-On`;
}

/**
 * Web address (product id) for a product of a given type: Perfumes keep the
 * plain fragrance slug; other types get a suffix so they never collide
 * ("black-velvet" and "black-velvet-roll-on").
 */
export function productIdFor(baseSlug: string, productTypeId: string | null | undefined): string {
  if (productFormat(productTypeId) === "perfume" || !productTypeId) return baseSlug.slice(0, 64);
  if (baseSlug.endsWith(`-${productTypeId}`)) return baseSlug.slice(0, 64);
  const suffix = `-${productTypeId}`;
  return `${baseSlug.slice(0, 64 - suffix.length).replace(/-+$/, "")}${suffix}`;
}

/** Splits products into the storefront sections, keeping their order. */
export function bySection<T extends { productTypeId?: string | null }>(products: readonly T[]): Record<ProductFormat, T[]> {
  const out: Record<ProductFormat, T[]> = { perfume: [], "roll-on": [], other: [] };
  for (const p of products) out[productFormat(p.productTypeId)].push(p);
  return out;
}

/**
 * Migration check (read-only): a size inside a Perfume that looks like a
 * Roll-On (label "… Roll-On" or a "-RO-" SKU). Before Perfumes and Roll-Ons
 * were separated, an import could store the Roll-On as a Perfume size. Such
 * products are only reported (Admin → Products); nothing is changed automatically.
 */
export function looksLikeRollOnVariant(v: { label?: string; sku?: string; status?: string }): boolean {
  if (v.status === "ARCHIVED") return false;
  return /roll[\s-]?on/i.test(v.label ?? "") || /-RO-/i.test(v.sku ?? "");
}

export function perfumesWithRollOnSizes<P extends { id: string; name: string; productTypeId?: string | null; variants?: readonly { label?: string; sku?: string; status?: string }[] }>(
  products: readonly P[],
): { id: string; name: string; sizes: string[] }[] {
  return products
    .filter((p) => productFormat(p.productTypeId) === "perfume")
    .map((p) => ({ id: p.id, name: p.name, sizes: (p.variants ?? []).filter(looksLikeRollOnVariant).map((v) => v.label ?? v.sku ?? "") }))
    .filter((p) => p.sizes.length > 0);
}

/** Category of a Roll-On product. */
export const ROLL_ON_CATEGORY = "Roll-On";

/**
 * Category for an imported product: a Roll-On listed under a perfume category
 * ("Perfume", "Perfumes") becomes "Roll-On"; any other category is kept.
 * Perfumes keep their category. Sections never depend on the category.
 */
export function categoryForType(productTypeId: string | null | undefined, category: string): string {
  if (productFormat(productTypeId) === "roll-on" && /^perfumes?$/i.test(category.trim())) return ROLL_ON_CATEGORY;
  return category;
}

/** Fragrance identity of a product name: case, spacing and a trailing "Roll-On" ignored. */
export function fragranceKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*\broll[\s-]?on$/, "")
    .trim();
}

/**
 * Number of distinct fragrances among the given products: a fragrance sold as
 * a Perfume and as a Roll-On counts once. Pass active products only.
 */
export function countUniqueFragrances(products: readonly { name: string }[]): number {
  return new Set(products.map((p) => fragranceKey(p.name)).filter(Boolean)).size;
}

/** Homepage benefit title: "37 Signature Scents" (no number when there are none). */
export function signatureScentsTitle(count: number): string {
  if (count <= 0) return "Signature Scents";
  return `${count} Signature ${count === 1 ? "Scent" : "Scents"}`;
}
