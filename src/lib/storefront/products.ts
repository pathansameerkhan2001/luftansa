import "server-only";

import type { BottleSizeMl, ProductOption } from "@/data/products";
import { getNoteImage } from "@/data/fragrance-profiles";
import { withFamilyImages } from "@/data/note-families";
import { displayName, productFormat, type ProductFormat } from "@/lib/catalogue/product-format";
import { buildLegacyCatalogue } from "@/lib/catalogue/legacy-catalogue";
import { getDataServices } from "@/lib/db/client";
import { getProductWithVariants, listAllProductsWithVariants } from "@/lib/db/products-service";
import type { FragranceNoteItem, ProductItem, ProductVariantItem } from "@/lib/db/schemas";
import { getAssetUrl } from "@/lib/assets";
import { productHref } from "@/lib/routes";
import { sortByDisplayOrder } from "@/lib/storefront/collections";
import type { ProductCardData } from "@/components/collection/ProductCard";

export interface StorefrontNote {
  name: string;
  description?: string;
  image?: { src: string; alt: string };
}

export interface UnifiedStorefrontProduct {
  slug: string;
  name: string;
  /** Storefront section: "perfume" (sprays), "roll-on", or "other" (in neither section). */
  format: ProductFormat;
  /** Customer-facing name, e.g. "Black Velvet Roll-On" for a Roll-On (src/lib/catalogue/product-format.ts). */
  displayName: string;
  description?: string;
  category: string;
  productTypeId?: string;
  productTypeName?: string;
  hasNotes: boolean;
  sizes: readonly BottleSizeMl[];
  options: readonly ProductOption[];
  mainImage?: { src: string; alt: string; objectPosition?: string };
  galleryImages: readonly { src: string; alt: string; objectPosition?: string }[];
  keywords: readonly string[];
  notes: {
    top: readonly StorefrontNote[];
    heart: readonly StorefrontNote[];
    base: readonly StorefrontNote[];
  };
  featured: boolean;
  bestseller: boolean;
  /** Promotional card badges (Admin → Products). */
  newLaunch: boolean;
  buyOneGetOne: boolean;
  /** Homepage collections this product is placed in ("signature", "personality"). */
  collections: readonly string[];
  displayOrder?: number;
  concentration?: string;
  gender?: string;
  /** "dynamodb" normally; "fallback" only while DynamoDB is unreachable. */
  source: "dynamodb" | "fallback";
}

function resolveAssetUrl(key: string | undefined): string | undefined {
  if (!key) return undefined;
  if (key.startsWith("http://") || key.startsWith("https://")) return key;
  return getAssetUrl(key);
}

/**
 * Purchasable options: ACTIVE variants only, in their configured order.
 * Inactive and archived variants never reach the storefront, and no option
 * or price is ever synthesised when a product has no active variants.
 */
export function toStorefrontOptions(variants: readonly ProductVariantItem[]): ProductOption[] {
  return variants
    .filter((v) => v.status === "ACTIVE")
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((v) => {
      const capacity = v.capacity ?? v.sizeMl;
      const unit = v.unit ?? "ml";
      return {
        id: v.id ?? v.sk.replace("VARIANT#", ""),
        label: v.label || `${capacity} ${unit}`,
        priceInr: v.priceInr,
        mrpInr: v.mrpInr !== undefined && v.mrpInr > v.priceInr ? v.mrpInr : undefined,
        // Only when the admin has configured it; unset stays unset.
        ...(v.stockQuantity !== undefined ? { stockQuantity: v.stockQuantity } : {}),
      };
    });
}

function mapNotes(items: readonly FragranceNoteItem[] = []): StorefrontNote[] {
  return items.map((n) => {
    // The photo uploaded for this note in Admin → Products wins; a note without one
    // uses the curated ingredient photography (if any); the rest get a family photo.
    const curated = getNoteImage(n.name);
    const uploaded = resolveAssetUrl(n.imageKey);
    const src = uploaded ?? curated?.src;
    // Keep the descriptive alt text of the curated note photography when it is used.
    const alt = curated && (!uploaded || curated.src === n.imageKey) ? curated.alt : n.name;
    return { name: n.name, description: n.description, image: src ? { src, alt } : undefined };
  });
}

/** Converts a DynamoDB product and its variants into the storefront view model. */
export function mapProductToStorefront(
  product: ProductItem,
  variants: readonly ProductVariantItem[],
  source: UnifiedStorefrontProduct["source"] = "dynamodb",
): UnifiedStorefrontProduct {
  const mainSrc = resolveAssetUrl(product.mainImageKey || product.imageKey);
  const mainImage = mainSrc
    ? { src: mainSrc, alt: product.mainImageAlt || product.imageAlt || `${product.name} bottle` }
    : undefined;

  const galleryImages = (product.galleryImageKeys ?? [])
    .map((k) => resolveAssetUrl(k))
    .filter((src): src is string => Boolean(src))
    .map((src, idx) => ({ src, alt: `${product.name} photograph ${idx + 1}` }));

  // Note photos: uploaded → curated ingredient photo → fragrance-family photo (unique within the product).
  const [top, heart, base] = withFamilyImages([mapNotes(product.notes?.top), mapNotes(product.notes?.heart), mapNotes(product.notes?.base)]);
  const hasNotes = (product.notesEnabled ?? true) && top.length + heart.length + base.length > 0;

  return {
    slug: product.id,
    name: product.name,
    format: productFormat(product.productTypeId),
    displayName: displayName(product.name, product.productTypeId),
    description: product.description,
    category: product.category,
    productTypeId: product.productTypeId,
    productTypeName: product.productTypeName || product.category,
    hasNotes,
    sizes: (product.sizes ?? []).filter((s): s is BottleSizeMl => s === 30 || s === 50 || s === 100),
    options: toStorefrontOptions(variants),
    mainImage,
    galleryImages,
    keywords: product.keywords ?? [],
    notes: { top, heart, base },
    featured: product.featured ?? false,
    bestseller: product.bestseller ?? false,
    newLaunch: product.newLaunch ?? false,
    buyOneGetOne: product.buyOneGetOne ?? false,
    collections: product.collections ?? [],
    displayOrder: product.displayOrder,
    concentration: product.concentration,
    gender: product.gender,
    source,
  };
}

/** Active products only, in storefront display order. */
export function buildStorefrontCatalogue(
  entries: readonly { product: ProductItem; variants: readonly ProductVariantItem[] }[],
  source: UnifiedStorefrontProduct["source"] = "dynamodb",
): UnifiedStorefrontProduct[] {
  return sortByDisplayOrder(
    entries
      .filter((e) => e.product.status === "ACTIVE")
      .map((e) => mapProductToStorefront(e.product, e.variants, source)),
  );
}

/**
 * Outage fallback: the legacy catalogue, used ONLY when DynamoDB cannot be
 * reached (or is not configured). It is never merged with DynamoDB data, so
 * products deleted or deactivated in the admin can never reappear.
 */
export function fallbackStorefrontCatalogue(): UnifiedStorefrontProduct[] {
  const { entries } = buildLegacyCatalogue({ now: new Date(0).toISOString() });
  return buildStorefrontCatalogue(entries, "fallback");
}

/**
 * All active products for the public storefront.
 * DynamoDB is the single source of truth (the same data the admin manages).
 */
export async function getActiveStorefrontProducts(): Promise<UnifiedStorefrontProduct[]> {
  const data = getDataServices();
  if (!data) {
    console.error("[storefront] DynamoDB is not configured; serving the outage fallback catalogue.");
    return fallbackStorefrontCatalogue();
  }
  try {
    const entries = await listAllProductsWithVariants(data.repo, { status: "ACTIVE" });
    return buildStorefrontCatalogue(entries);
  } catch (e) {
    console.error("[storefront] DynamoDB read failed; serving the outage fallback catalogue:", (e as Error).message);
    return fallbackStorefrontCatalogue();
  }
}

/**
 * A single active product for the product detail page, or null (404) when it
 * does not exist in DynamoDB or is inactive.
 */
export async function getActiveStorefrontProductBySlug(
  slug: string,
): Promise<UnifiedStorefrontProduct | null> {
  const data = getDataServices();
  if (data) {
    try {
      const result = await getProductWithVariants(data.repo, slug);
      if (!result || result.product.status !== "ACTIVE") return null;
      return mapProductToStorefront(result.product, result.variants);
    } catch (e) {
      console.error(`[storefront] DynamoDB lookup failed for ${slug}; using the outage fallback:`, (e as Error).message);
    }
  } else {
    console.error("[storefront] DynamoDB is not configured; using the outage fallback.");
  }
  return fallbackStorefrontCatalogue().find((p) => p.slug === slug) ?? null;
}

/** Formats a UnifiedStorefrontProduct into ProductCardData */
export function toStorefrontCardData(product: UnifiedStorefrontProduct): ProductCardData {
  return {
    slug: product.slug,
    name: product.displayName,
    description: product.description,
    href: productHref(product.slug),
    options: product.options,
    image: product.mainImage,
    placeholder: product.format === "roll-on" ? "roll-on" : "spray",
  };
}
