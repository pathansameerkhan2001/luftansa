import "server-only";

import {
  type BottleSizeMl,
  type ProductOption,
  PRODUCTS,
  sprayOptions,
  type Product as HardcodedProduct,
} from "@/data/products";
import { FRAGRANCE_PROFILES, getNoteImage } from "@/data/fragrance-profiles";
import { getDataServices } from "@/lib/db/client";
import { getProductWithVariants, listProducts } from "@/lib/db/products-service";
import type { FragranceNoteItem, ProductItem, ProductVariantItem } from "@/lib/db/schemas";
import { getAssetUrl } from "@/lib/assets";
import { productHref } from "@/lib/routes";
import type { ProductCardData } from "@/components/collection/ProductCard";

export interface StorefrontNote {
  name: string;
  description?: string;
  image?: { src: string; alt: string };
}

export interface UnifiedStorefrontProduct {
  slug: string;
  name: string;
  description?: string;
  category: string;
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
  concentration?: string;
  gender?: string;
  source: "dynamodb" | "hardcoded";
}

function resolveAssetUrl(key: string | undefined): string | undefined {
  if (!key) return undefined;
  if (key.startsWith("http://") || key.startsWith("https://")) return key;
  return getAssetUrl(key);
}

/** Converts a DynamoDB ProductItem and its variants into a UnifiedStorefrontProduct */
function mapDynamoToUnified(
  product: ProductItem,
  variants: ProductVariantItem[] = [],
): UnifiedStorefrontProduct {
  const mainKey = product.mainImageKey || product.imageKey;
  const mainImage = mainKey
    ? {
        src: resolveAssetUrl(mainKey)!,
        alt: product.mainImageAlt || product.imageAlt || `${product.name} bottle`,
      }
    : undefined;

  const galleryImages = (product.galleryImageKeys ?? [])
    .map((k) => resolveAssetUrl(k))
    .filter((src): src is string => Boolean(src))
    .map((src, idx) => ({
      src,
      alt: `${product.name} photograph ${idx + 1}`,
    }));

  // Build options from active variants or standard pricing
  const variantMap = new Map(variants.map((v) => [v.sizeMl, v]));
  const options: ProductOption[] = (product.sizes as BottleSizeMl[]).map((size) => {
    const v = variantMap.get(size);
    const priceInr = v?.priceInr ?? (size === 30 ? 400 : size === 50 ? 630 : 1000);
    return {
      id: `${size}ml`,
      label: `${size} ml`,
      priceInr,
      mrpInr: v?.mrpInr,
    };
  });

  const mapNotes = (items: FragranceNoteItem[] = []): StorefrontNote[] =>
    items.map((n) => ({
      name: n.name,
      description: n.description,
      image: n.imageKey ? { src: resolveAssetUrl(n.imageKey)!, alt: n.name } : undefined,
    }));

  return {
    slug: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    sizes: product.sizes as BottleSizeMl[],
    options,
    mainImage,
    galleryImages,
    keywords: product.keywords ?? [],
    notes: {
      top: mapNotes(product.notes?.top),
      heart: mapNotes(product.notes?.heart),
      base: mapNotes(product.notes?.base),
    },
    featured: product.featured ?? false,
    bestseller: product.bestseller ?? false,
    concentration: product.concentration,
    gender: product.gender,
    source: "dynamodb",
  };
}

/** Converts a hardcoded product from src/data/products.ts into a UnifiedStorefrontProduct */
function mapHardcodedToUnified(product: HardcodedProduct): UnifiedStorefrontProduct {
  const profile = FRAGRANCE_PROFILES[product.slug] ?? {};
  const mainImage = product.image
    ? {
        src: getAssetUrl(product.image.key),
        alt: product.image.alt,
        objectPosition: product.image.objectPosition,
      }
    : undefined;

  const galleryImages = (product.gallery ?? []).map((img) => ({
    src: getAssetUrl(img.key),
    alt: img.alt,
    objectPosition: img.objectPosition,
  }));

  const mapTier = (noteName?: string): StorefrontNote[] => {
    if (!noteName) return [];
    const img = getNoteImage(noteName);
    return [
      {
        name: noteName,
        image: img ? { src: img.src, alt: img.alt } : undefined,
      },
    ];
  };

  return {
    slug: product.slug,
    name: product.name,
    description: product.description ?? profile.description,
    category: product.category ?? "Perfume",
    sizes: product.sizes,
    options: sprayOptions(product),
    mainImage,
    galleryImages,
    keywords: [],
    notes: {
      top: mapTier(profile.notes?.top),
      heart: mapTier(profile.notes?.middle),
      base: mapTier(profile.notes?.base),
    },
    featured: false,
    bestseller: false,
    concentration: product.concentration,
    gender: product.gender,
    source: "hardcoded",
  };
}

/**
 * Retrieves all active products for the public storefront.
 *
 * Rules:
 * - Reads active DynamoDB products (`status === "ACTIVE"`).
 * - Suppresses products marked `INACTIVE` in DynamoDB (they will NOT fallback to hardcoded).
 * - Preserves hardcoded catalogue products that do not exist in DynamoDB.
 * - Deduplicates: DynamoDB version takes precedence for the same slug.
 * - If DynamoDB is offline or fails, falls back gracefully to hardcoded catalogue.
 */
export async function getActiveStorefrontProducts(): Promise<UnifiedStorefrontProduct[]> {
  const data = getDataServices();
  const suppressedSlugs = new Set<string>();
  const unifiedMap = new Map<string, UnifiedStorefrontProduct>();

  if (data) {
    try {
      // Fetch products using GSI1 zero-scan query
      const { items: allDbProducts } = await listProducts(data.repo, { limit: 100 });

      for (const item of allDbProducts) {
        if (item.status === "INACTIVE") {
          suppressedSlugs.add(item.id);
        } else if (item.status === "ACTIVE") {
          // Fetch variants for each active product
          try {
            const withVariants = await getProductWithVariants(data.repo, item.id);
            unifiedMap.set(item.id, mapDynamoToUnified(item, withVariants?.variants));
          } catch {
            unifiedMap.set(item.id, mapDynamoToUnified(item));
          }
        }
      }
    } catch (e) {
      console.warn("[storefront] DynamoDB read failed, falling back to hardcoded catalogue:", (e as Error).message);
    }
  }

  // Merge hardcoded catalogue for any product not yet registered in DynamoDB
  for (const hardcoded of PRODUCTS) {
    // If explicitly marked INACTIVE in DynamoDB, it must remain hidden
    if (suppressedSlugs.has(hardcoded.slug)) {
      continue;
    }
    // If already active from DynamoDB, DynamoDB takes precedence
    if (unifiedMap.has(hardcoded.slug)) {
      continue;
    }
    unifiedMap.set(hardcoded.slug, mapHardcodedToUnified(hardcoded));
  }

  return Array.from(unifiedMap.values());
}

/**
 * Retrieves a single product for the product detail page by slug.
 *
 * Rules:
 * - If the product exists in DynamoDB and is `INACTIVE`, returns `null` (404, never fallback to active).
 * - If active in DynamoDB, returns the DynamoDB record.
 * - If not found in DynamoDB, falls back to hardcoded catalogue.
 * - If DynamoDB is unavailable, falls back gracefully to hardcoded catalogue.
 */
export async function getActiveStorefrontProductBySlug(
  slug: string,
): Promise<UnifiedStorefrontProduct | null> {
  const data = getDataServices();

  if (data) {
    try {
      const dbResult = await getProductWithVariants(data.repo, slug);
      if (dbResult) {
        // Inactive products in DynamoDB MUST NOT be exposed on storefront
        if (dbResult.product.status === "INACTIVE") {
          return null;
        }
        return mapDynamoToUnified(dbResult.product, dbResult.variants);
      }
    } catch (e) {
      console.warn(`[storefront] DynamoDB lookup failed for ${slug}, checking hardcoded fallback:`, (e as Error).message);
    }
  }

  // Fallback to hardcoded catalogue
  const hardcoded = PRODUCTS.find((p) => p.slug === slug);
  if (hardcoded) {
    return mapHardcodedToUnified(hardcoded);
  }

  return null;
}

/** Formats a UnifiedStorefrontProduct into ProductCardData */
export function toStorefrontCardData(product: UnifiedStorefrontProduct): ProductCardData {
  return {
    slug: product.slug,
    name: product.name,
    description: product.description,
    href: productHref(product.slug),
    options: product.options,
    image: product.mainImage,
  };
}
