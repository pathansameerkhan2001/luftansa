import "server-only";

import { ENTITY, keys, SK_PREFIX, assertId } from "./keys";
import { Repository, NotFoundError, ValidationError } from "./repository";
import { AuditService } from "./audit";
import {
  type ProductCreateInput,
  type ProductItem,
  type ProductStatus,
  type ProductUpdateInput,
  type ProductVariantItem,
  productCreateInputSchema,
  productItemSchema,
  productUpdateInputSchema,
  productVariantItemSchema,
  auditEntrySchema,
  STANDARD_PRICES_INR,
} from "./schemas";
import type { TransactOperation } from "./repository";

/** Confirmed standard price for a standard spray size (30/50/100 ml), otherwise undefined. */
function standardPriceFor(capacity: number, unit: string): number | undefined {
  return unit === "ml" ? (STANDARD_PRICES_INR as Record<number, number>)[capacity] : undefined;
}

/** Price for a new variant: explicit price, or the confirmed standard price. Never invented. */
function resolveNewVariantPrice(priceInr: number | undefined, capacity: number, unit: string, index: number): number {
  const price = priceInr ?? standardPriceFor(capacity, unit);
  if (price === undefined) {
    throw new ValidationError([
      { path: `variants.${index}.priceInr`, message: `A price is required for ${capacity} ${unit} (no confirmed standard price).` },
    ]);
  }
  return price;
}

/** null clears an optional value, undefined keeps the current one. */
function nextOptional<T>(input: T | null | undefined, current: T | undefined): T | undefined {
  if (input === null) return undefined;
  return input ?? current;
}

function unique<T>(values: readonly T[] | undefined): T[] | undefined {
  return values ? Array.from(new Set(values)) : undefined;
}

export interface ProductWithVariants {
  product: ProductItem;
  variants: ProductVariantItem[];
}

export interface ListProductsOptions {
  status?: ProductStatus;
  limit?: number;
  cursor?: string;
}

export interface ListProductsResult {
  items: ProductItem[];
  cursor?: string;
}

function normalizeVariant(v: ProductVariantItem): ProductVariantItem {
  const capacity = v.capacity ?? v.sizeMl ?? 30;
  const unit = v.unit ?? "ml";
  const id = v.id ?? (v.sizeMl ? String(v.sizeMl).padStart(5, "0") : v.sk.replace("VARIANT#", ""));
  const label = v.label ?? `${capacity} ${unit}`;
  return {
    ...v,
    id,
    capacity,
    unit,
    label,
    sizeMl: v.sizeMl ?? (unit === "ml" ? capacity : undefined),
    status: v.status ?? "ACTIVE",
    sortOrder: v.sortOrder ?? 0,
  };
}

function normalizeProduct(p: ProductItem): ProductItem {
  return {
    ...p,
    productTypeId: p.productTypeId ?? "perfume-spray",
    productTypeName: p.productTypeName ?? p.category ?? "Perfume",
    notesEnabled: p.notesEnabled ?? true,
    galleryImageKeys: p.galleryImageKeys ?? [],
    keywords: p.keywords ?? [],
    notes: p.notes ?? { top: [], heart: [], base: [] },
  };
}

/**
 * Lists products using GSI1 for zero-scan pagination.
 * If status is provided, queries STATUS#<status>#.
 * Otherwise queries all products under GSI1PK = "PRODUCTS".
 */
export async function listProducts(
  repo: Repository,
  options: ListProductsOptions = {},
): Promise<ListProductsResult> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const skPrefix = options.status ? `STATUS#${options.status}#` : undefined;

  const result = await repo.queryIndex(
    "GSI1",
    "GSI1PK",
    "PRODUCTS",
    productItemSchema,
    {
      sortKeyPrefix: skPrefix,
      limit,
      cursor: options.cursor,
    },
  );

  return {
    items: result.items.map(normalizeProduct),
    cursor: result.cursor,
  };
}

/**
 * Lists every product (all pages) via GSI1. Optionally filtered by status.
 * Bounded to `maxPages` pages of 100 to keep a request predictable.
 */
export async function listAllProducts(
  repo: Repository,
  options: { status?: ProductStatus; maxPages?: number } = {},
): Promise<ProductItem[]> {
  const out: ProductItem[] = [];
  let cursor: string | undefined;
  const maxPages = options.maxPages ?? 20;
  for (let page = 0; page < maxPages; page++) {
    const result = await listProducts(repo, { status: options.status, limit: 100, cursor });
    out.push(...result.items);
    cursor = result.cursor;
    if (!cursor) break;
  }
  return out;
}

/** Every product with its variants (variants fetched in parallel, one query per product). */
export async function listAllProductsWithVariants(
  repo: Repository,
  options: { status?: ProductStatus } = {},
): Promise<ProductWithVariants[]> {
  const products = await listAllProducts(repo, options);
  const withVariants = await Promise.all(
    products.map(async (product) => {
      const { items } = await repo.query(keys.product(product.id).pk, productVariantItemSchema, {
        skPrefix: SK_PREFIX.variant,
      });
      return { product, variants: items.map(normalizeVariant) };
    }),
  );
  return withVariants;
}

/**
 * Retrieves a single product and all its variants.
 * Zero table scans: queries base table item and variant partition prefix.
 */
export async function getProductWithVariants(
  repo: Repository,
  productId: string,
): Promise<ProductWithVariants | null> {
  const product = await repo.get(keys.product(productId), productItemSchema);
  if (!product) return null;

  const { items: variants } = await repo.query(
    keys.product(productId).pk,
    productVariantItemSchema,
    { skPrefix: SK_PREFIX.variant },
  );

  return {
    product: normalizeProduct(product),
    variants: variants.map(normalizeVariant),
  };
}

/**
 * Creates a new product and initialises its variants atomically
 * with an audit trail entry using DynamoDB TransactWriteItems.
 * Supports dynamic variant IDs, custom capacities, units, prices and stock.
 */
export async function createProduct(
  repo: Repository,
  audit: AuditService,
  actorEmail: string,
  rawInput: ProductCreateInput,
): Promise<ProductWithVariants> {
  const input = productCreateInputSchema.parse(rawInput);
  const now = new Date().toISOString();

  const mainImageKey = input.mainImageKey ?? input.imageKey;
  const mainImageAlt = input.mainImageAlt ?? input.imageAlt;
  const category = input.category || input.productTypeName || "Perfume";

  const productItem: ProductItem = {
    pk: keys.product(input.id).pk,
    sk: keys.product(input.id).sk,
    entityType: ENTITY.product,
    id: input.id,
    name: input.name,
    description: input.description,
    productTypeId: input.productTypeId ?? "perfume-spray",
    productTypeName: input.productTypeName ?? category,
    category,
    status: input.status,
    notesEnabled: input.notesEnabled ?? true,
    sizes: input.sizes ?? [30, 50, 100],
    imageKey: mainImageKey,
    imageAlt: mainImageAlt,
    mainImageKey,
    mainImageAlt,
    galleryImageKeys: input.galleryImageKeys ?? [],
    keywords: input.keywords ?? [],
    notes: input.notes ?? { top: [], heart: [], base: [] },
    concentration: input.concentration,
    gender: input.gender,
    featured: input.featured ?? false,
    bestseller: input.bestseller ?? false,
    newLaunch: input.newLaunch ?? false,
    buyOneGetOne: input.buyOneGetOne ?? false,
    collections: unique(input.collections),
    displayOrder: input.displayOrder,
    unverifiedFields: unique(input.unverifiedFields),
    GSI1PK: "PRODUCTS",
    GSI1SK: keys.productGsi1(input.status, input.id).GSI1SK,
    GSI2PK: keys.productGsi2(category, input.id).GSI2PK,
    GSI2SK: keys.productGsi2(category, input.id).GSI2SK,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  const variants: ProductVariantItem[] = [];

  if (input.variants && input.variants.length > 0) {
    for (let i = 0; i < input.variants.length; i++) {
      const vInput = input.variants[i];
      const capacity = vInput.capacity ?? vInput.sizeMl ?? 30;
      const unit = vInput.unit ?? "ml";
      const variantId = vInput.id
        ? assertId(vInput.id, "variantId")
        : `v_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 6)}`;
      const label = vInput.label ?? `${capacity} ${unit}`;
      const priceInr = resolveNewVariantPrice(vInput.priceInr, capacity, unit, i);

      const variantKey = keys.variant(input.id, variantId);
      const variantItem: ProductVariantItem = {
        pk: variantKey.pk,
        sk: variantKey.sk,
        entityType: ENTITY.variant,
        productId: input.id,
        id: variantId,
        capacity,
        unit,
        label,
        sizeMl: unit === "ml" ? capacity : undefined,
        priceInr,
        mrpInr: vInput.mrpInr ?? undefined,
        stockQuantity: vInput.stockQuantity ?? undefined,
        sku: vInput.sku ?? undefined,
        status: vInput.status ?? "ACTIVE",
        sortOrder: vInput.sortOrder ?? i,
        createdAt: now,
        updatedAt: now,
        version: 1,
      };
      variants.push(variantItem);
    }
  } else {
    // Legacy fallback: initialize from sizes array
    const sizes = (input.sizes && input.sizes.length > 0) ? input.sizes : [30, 50, 100];
    for (let i = 0; i < sizes.length; i++) {
      const size = Number(sizes[i]) || 30;
      const variantId = String(size).padStart(5, "0");
      const variantKey = keys.variant(input.id, variantId);
      const priceInr = resolveNewVariantPrice(undefined, size, "ml", i);
      const variantItem: ProductVariantItem = {
        pk: variantKey.pk,
        sk: variantKey.sk,
        entityType: ENTITY.variant,
        productId: input.id,
        id: variantId,
        capacity: size,
        unit: "ml",
        label: `${size} ml`,
        sizeMl: size,
        priceInr,
        status: "ACTIVE",
        sortOrder: i,
        createdAt: now,
        updatedAt: now,
        version: 1,
      };
      variants.push(variantItem);
    }
  }

  const auditEntry = audit.buildEntry({
    actorEmail,
    action: "product.create",
    targetType: "PRODUCT",
    targetId: input.id,
    summary: `Created fragrance ${input.name} (${input.id}) with ${variants.length} variants`,
  });

  // Atomic transaction: Product + all Variants + Audit log in a single TransactWriteItems call
  const operations: TransactOperation[] = [
    { type: "put", item: productItem, schema: productItemSchema, condition: "not_exists" },
    ...variants.map((v) => ({
      type: "put" as const,
      item: v,
      schema: productVariantItemSchema,
      condition: "not_exists" as const,
    })),
    { type: "put", item: auditEntry, schema: auditEntrySchema, condition: "not_exists" },
  ];

  await repo.transactWrite(operations);

  return { product: productItem, variants };
}

/**
 * Updates a product metadata item and reconciles variants atomically.
 * Preserves historical orders by ARCHIVING removed variants instead of hard-deleting them.
 * Enforces optimistic concurrency via version check.
 */
export async function updateProduct(
  repo: Repository,
  audit: AuditService,
  actorEmail: string,
  productId: string,
  rawInput: ProductUpdateInput,
): Promise<ProductWithVariants> {
  const input = productUpdateInputSchema.parse(rawInput);
  const existing = await getProductWithVariants(repo, productId);
  if (!existing) throw new NotFoundError(`Product ${productId} not found`);

  const now = new Date().toISOString();
  const nextStatus = input.status ?? existing.product.status;
  const nextCategory = input.category ?? existing.product.category;
  const nextSizes = input.sizes ?? existing.product.sizes;

  const nextMainImageKey =
    input.mainImageKey !== undefined
      ? (input.mainImageKey === null ? undefined : input.mainImageKey)
      : input.imageKey !== undefined
        ? (input.imageKey === null ? undefined : input.imageKey)
        : (existing.product.mainImageKey ?? existing.product.imageKey);

  const nextMainImageAlt =
    input.mainImageAlt !== undefined
      ? (input.mainImageAlt === null ? undefined : input.mainImageAlt)
      : input.imageAlt !== undefined
        ? (input.imageAlt === null ? undefined : input.imageAlt)
        : (existing.product.mainImageAlt ?? existing.product.imageAlt);

  const nextProductItem: ProductItem = {
    ...existing.product,
    name: input.name ?? existing.product.name,
    description: input.description === null ? undefined : (input.description ?? existing.product.description),
    productTypeId: input.productTypeId === null ? undefined : (input.productTypeId ?? existing.product.productTypeId),
    productTypeName: input.productTypeName === null ? undefined : (input.productTypeName ?? existing.product.productTypeName),
    category: nextCategory,
    status: nextStatus,
    notesEnabled: input.notesEnabled !== undefined ? input.notesEnabled : (existing.product.notesEnabled ?? true),
    sizes: nextSizes,
    imageKey: nextMainImageKey,
    imageAlt: nextMainImageAlt,
    mainImageKey: nextMainImageKey,
    mainImageAlt: nextMainImageAlt,
    galleryImageKeys: input.galleryImageKeys ?? existing.product.galleryImageKeys ?? [],
    keywords: input.keywords ?? existing.product.keywords ?? [],
    notes: input.notes ?? existing.product.notes ?? { top: [], heart: [], base: [] },
    concentration: input.concentration === null ? undefined : (input.concentration ?? existing.product.concentration),
    gender: input.gender === null ? undefined : (input.gender ?? existing.product.gender),
    featured: input.featured ?? existing.product.featured,
    bestseller: input.bestseller ?? existing.product.bestseller,
    newLaunch: input.newLaunch ?? existing.product.newLaunch ?? false,
    buyOneGetOne: input.buyOneGetOne ?? existing.product.buyOneGetOne ?? false,
    collections: unique(input.collections) ?? existing.product.collections,
    displayOrder: nextOptional(input.displayOrder, existing.product.displayOrder),
    unverifiedFields: unique(input.unverifiedFields) ?? existing.product.unverifiedFields,
    GSI1PK: "PRODUCTS",
    GSI1SK: keys.productGsi1(nextStatus, productId).GSI1SK,
    GSI2PK: keys.productGsi2(nextCategory, productId).GSI2PK,
    GSI2SK: keys.productGsi2(nextCategory, productId).GSI2SK,
    updatedAt: now,
    version: input.version + 1,
  };

  const existingVariantMap = new Map(
    existing.variants.map((v) => [
      v.id ?? (v.sizeMl ? String(v.sizeMl).padStart(5, "0") : v.sk.replace("VARIANT#", "")),
      v,
    ]),
  );

  const seenVariantIds = new Set<string>();
  const updatedVariants: ProductVariantItem[] = [];
  const variantOps: TransactOperation[] = [];

  if (input.variants && input.variants.length > 0) {
    for (let i = 0; i < input.variants.length; i++) {
      const vInput = input.variants[i];
      const capacity = vInput.capacity ?? vInput.sizeMl ?? 30;
      const unit = vInput.unit ?? "ml";
      const variantId = vInput.id
        ? assertId(vInput.id, "variantId")
        : `v_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 6)}`;
      seenVariantIds.add(variantId);

      const existingVariant = existingVariantMap.get(variantId);
      const variantKey = keys.variant(productId, variantId);

      if (existingVariant) {
        const nextPrice = vInput.priceInr ?? existingVariant.priceInr;
        const nextStock = nextOptional(vInput.stockQuantity, existingVariant.stockQuantity);
        const nextStatus = vInput.status ?? existingVariant.status;
        const nextSku = nextOptional(vInput.sku, existingVariant.sku);
        const nextLabel = vInput.label ?? existingVariant.label ?? `${capacity} ${unit}`;

        const replaced: ProductVariantItem = {
          ...existingVariant,
          id: variantId,
          capacity,
          unit,
          label: nextLabel,
          sizeMl: unit === "ml" ? capacity : existingVariant.sizeMl,
          priceInr: nextPrice,
          mrpInr: nextOptional(vInput.mrpInr, existingVariant.mrpInr),
          stockQuantity: nextStock,
          sku: nextSku,
          status: nextStatus,
          sortOrder: vInput.sortOrder ?? existingVariant.sortOrder ?? i,
          updatedAt: now,
          version: existingVariant.version + 1,
        };
        variantOps.push({
          type: "put",
          item: replaced,
          schema: productVariantItemSchema,
          condition: "exists_version",
          expectedVersion: existingVariant.version,
        });
        updatedVariants.push(replaced);
      } else {
        const created: ProductVariantItem = {
          pk: variantKey.pk,
          sk: variantKey.sk,
          entityType: ENTITY.variant,
          productId,
          id: variantId,
          capacity,
          unit,
          label: vInput.label ?? `${capacity} ${unit}`,
          sizeMl: unit === "ml" ? capacity : undefined,
          priceInr: resolveNewVariantPrice(vInput.priceInr, capacity, unit, i),
          mrpInr: vInput.mrpInr ?? undefined,
          stockQuantity: vInput.stockQuantity ?? undefined,
          sku: vInput.sku ?? undefined,
          status: vInput.status ?? "ACTIVE",
          sortOrder: vInput.sortOrder ?? i,
          createdAt: now,
          updatedAt: now,
          version: 1,
        };
        variantOps.push({
          type: "put",
          item: created,
          schema: productVariantItemSchema,
          condition: "not_exists",
        });
        updatedVariants.push(created);
      }
    }

    // REQUIREMENT 2 & 4: Archive removed variants instead of hard-deleting them!
    // Preserves historical order references, invoice line items, and SKUs.
    for (const [existingId, existingV] of existingVariantMap.entries()) {
      if (!seenVariantIds.has(existingId) && existingV.status !== "ARCHIVED") {
        const archived: ProductVariantItem = {
          ...existingV,
          status: "ARCHIVED",
          archivedAt: now,
          updatedAt: now,
          version: existingV.version + 1,
        };
        variantOps.push({
          type: "put",
          item: archived,
          schema: productVariantItemSchema,
          condition: "exists_version",
          expectedVersion: existingV.version,
        });
        updatedVariants.push(archived);
      }
    }
  } else {
    updatedVariants.push(...existing.variants);
  }

  const auditEntry = audit.buildEntry({
    actorEmail,
    action: "product.update",
    targetType: "PRODUCT",
    targetId: productId,
    summary: `Updated fragrance ${nextProductItem.name} (version ${nextProductItem.version})`,
  });

  // Atomic transaction: Product update + all variant updates/archivals + audit log
  await repo.transactWrite([
    {
      type: "put",
      item: nextProductItem,
      schema: productItemSchema,
      condition: "exists_version",
      expectedVersion: input.version,
    },
    ...variantOps,
    {
      type: "put",
      item: auditEntry,
      schema: auditEntrySchema,
      condition: "not_exists",
    },
  ]);

  return { product: nextProductItem, variants: updatedVariants };
}

/**
 * Deletes a product, its variants, and writes an audit log in a single atomic transaction.
 * Enforces optimistic concurrency: if the version does not match, nothing is deleted.
 */
export async function deleteProduct(
  repo: Repository,
  audit: AuditService,
  actorEmail: string,
  productId: string,
  expectedVersion?: number,
): Promise<void> {
  const existing = await getProductWithVariants(repo, productId);
  if (!existing) throw new NotFoundError(`Product ${productId} not found`);

  const auditEntry = audit.buildEntry({
    actorEmail,
    action: "product.delete",
    targetType: "PRODUCT",
    targetId: productId,
    summary: `Deleted fragrance ${existing.product.name} (${productId}) and ${existing.variants.length} variants`,
  });

  const operations: TransactOperation[] = [
    {
      type: "delete",
      key: keys.product(productId),
      condition: expectedVersion !== undefined ? "exists_version" : "exists",
      expectedVersion,
    },
    ...existing.variants.map((v) => ({
      type: "delete" as const,
      key: { pk: v.pk, sk: v.sk },
      condition: "exists" as const,
    })),
    {
      type: "put",
      item: auditEntry,
      schema: auditEntrySchema,
      condition: "not_exists",
    },
  ];

  await repo.transactWrite(operations);
}
