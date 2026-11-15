/**
 * The legacy hardcoded storefront catalogue (src/data/products.ts and
 * src/data/fragrance-profiles.ts) expressed as DynamoDB product + variant items.
 *
 * Used by:
 * - scripts/import-catalogue.ts: one-off, idempotent import of the products
 *   that are missing from DynamoDB.
 * - The storefront outage fallback (only when DynamoDB cannot be reached).
 *
 * Rules:
 * - Only information that the storefront displays today is carried over.
 *   Nothing is invented: no SKUs, no stock quantities, no descriptions or
 *   notes beyond what is already shown.
 * - Prices come only from the confirmed standard spray prices per size.
 * - Variant IDs keep the storefront option IDs ("30ml", "50ml", "100ml") so
 *   cart line items stay compatible.
 * - Content sourced from FRAGRANCE_PROFILES is still "to be confirmed", so it
 *   is flagged in `unverifiedFields` and shown as unverified in the admin.
 * - Homepage placements are carried over as `collections`, `bestseller` and
 *   `displayOrder` (the position in the legacy PRODUCTS list).
 */
import {
  BEST_SELLER_SLUGS,
  PERSONALITY_COLLECTION_SLUGS,
  PRODUCTS,
  SIGNATURE_PRODUCT_SLUGS,
  STANDARD_PRICES_INR,
  type Product,
} from "../../data/products";
import { FRAGRANCE_PROFILES, getNoteImage, type NoteTier } from "../../data/fragrance-profiles";
import { ENTITY, keys } from "../db/keys";
import {
  productItemSchema,
  productVariantItemSchema,
  type FragranceNoteItem,
  type FragranceNotes,
  type ProductItem,
  type ProductVariantItem,
  type StorefrontCollection,
  type VerifiableField,
} from "../db/schemas";

export const LEGACY_PRODUCT_TYPE_ID = "perfume-spray";
/** Category shown on the storefront for legacy products today. */
export const LEGACY_CATEGORY = "Perfume";

export interface LegacyCatalogueEntry {
  product: ProductItem;
  variants: ProductVariantItem[];
}

export interface LegacyCatalogueOptions {
  /** ISO timestamp used for createdAt/updatedAt. */
  now: string;
  /** Display name of the `perfume-spray` product type as stored in DynamoDB, if known. */
  productTypeName?: string;
}

export interface LegacyCatalogueResult {
  entries: LegacyCatalogueEntry[];
  /** Data in the legacy catalogue that cannot be represented and was NOT carried over. */
  warnings: string[];
}

function noteId(tier: string, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${tier}-${slug || "note"}`;
}

function legacyNote(tier: "top" | "heart" | "base", name: string | undefined): FragranceNoteItem[] {
  if (!name) return [];
  const image = getNoteImage(name);
  return [{ id: noteId(tier, name), name, imageKey: image?.src }];
}

function collectionsFor(slug: string): StorefrontCollection[] {
  const out: StorefrontCollection[] = [];
  if ((SIGNATURE_PRODUCT_SLUGS as readonly string[]).includes(slug)) out.push("signature");
  if ((PERSONALITY_COLLECTION_SLUGS as readonly string[]).includes(slug)) out.push("personality");
  return out;
}

function toEntry(product: Product, index: number, options: LegacyCatalogueOptions, warnings: string[]): LegacyCatalogueEntry {
  const profile = FRAGRANCE_PROFILES[product.slug] ?? {};
  const unverified: VerifiableField[] = [];

  // Description: confirmed product description wins; otherwise the profile
  // description that the storefront currently displays (unverified).
  let description = product.description;
  if (!description && profile.description) {
    description = profile.description;
    unverified.push("description");
  }

  const tierName = (tier: NoteTier) => profile.notes?.[tier];
  const notes: FragranceNotes = {
    top: legacyNote("top", tierName("top")),
    heart: legacyNote("heart", tierName("middle")),
    base: legacyNote("base", tierName("base")),
  };
  if (notes.top.length + notes.heart.length + notes.base.length > 0) unverified.push("notes");

  if (product.offers && product.offers.length > 0) {
    warnings.push(`${product.slug}: promotional offers are not stored in DynamoDB yet and were not imported.`);
  }
  if (product.image?.objectPosition || product.gallery?.some((g) => g.objectPosition)) {
    warnings.push(`${product.slug}: image objectPosition is not stored in DynamoDB and was not imported.`);
  }
  if ((product.gallery?.length ?? 0) > 8) {
    warnings.push(`${product.slug}: only the first 8 gallery images can be stored.`);
  }

  const productKey = keys.product(product.slug);
  const gsi1 = keys.productGsi1("ACTIVE", product.slug);
  const gsi2 = keys.productGsi2(product.category ?? LEGACY_CATEGORY, product.slug);
  const category = product.category ?? LEGACY_CATEGORY;

  const item: ProductItem = productItemSchema.parse({
    ...productKey,
    entityType: ENTITY.product,
    id: product.slug,
    name: product.name,
    description,
    productTypeId: LEGACY_PRODUCT_TYPE_ID,
    productTypeName: options.productTypeName,
    category,
    status: "ACTIVE",
    notesEnabled: true,
    sizes: [...product.sizes],
    imageKey: product.image?.key,
    imageAlt: product.image?.alt,
    mainImageKey: product.image?.key,
    mainImageAlt: product.image?.alt,
    galleryImageKeys: (product.gallery ?? []).slice(0, 8).map((g) => g.key),
    keywords: [],
    notes,
    concentration: product.concentration,
    gender: product.gender,
    featured: false,
    bestseller: (BEST_SELLER_SLUGS as readonly string[]).includes(product.slug),
    collections: collectionsFor(product.slug),
    displayOrder: index,
    unverifiedFields: unverified.length > 0 ? unverified : undefined,
    ...gsi1,
    ...gsi2,
    createdAt: options.now,
    updatedAt: options.now,
    version: 1,
  });

  const variants = product.sizes.map((ml, i) => {
    const priceInr = STANDARD_PRICES_INR[ml];
    const mrp = product.mrpInr?.[ml];
    const variantId = `${ml}ml`;
    return productVariantItemSchema.parse({
      ...keys.variant(product.slug, variantId),
      entityType: ENTITY.variant,
      productId: product.slug,
      id: variantId,
      capacity: ml,
      unit: "ml",
      label: `${ml} ml`,
      sizeMl: ml,
      priceInr,
      mrpInr: mrp !== undefined && mrp > priceInr ? mrp : undefined,
      // sku and stockQuantity intentionally unset: not configured yet.
      status: "ACTIVE",
      sortOrder: i,
      createdAt: options.now,
      updatedAt: options.now,
      version: 1,
    });
  });

  return { product: item, variants };
}

/** Builds DynamoDB items for every product in the legacy hardcoded catalogue. */
export function buildLegacyCatalogue(options: LegacyCatalogueOptions): LegacyCatalogueResult {
  const warnings: string[] = [];
  const entries = PRODUCTS.map((p, i) => toEntry(p, i, options, warnings));
  return { entries, warnings };
}
