import "server-only";

import { ENTITY, keys, SK_PREFIX } from "./keys";
import type { Repository, TransactOperation } from "./repository";
import { NotFoundError } from "./repository";
import type { AuditService } from "./audit";
import {
  type BottleSizeMl,
  type ProductCreateInput,
  type ProductItem,
  type ProductStatus,
  type ProductUpdateInput,
  type ProductVariantItem,
  auditEntrySchema,
  productCreateInputSchema,
  productItemSchema,
  productUpdateInputSchema,
  productVariantItemSchema,
  STANDARD_PRICES_INR,
} from "./schemas";

export interface ProductWithVariants {
  product: ProductItem;
  variants: ProductVariantItem[];
}

/**
 * Lists products using GSI1 (zero DynamoDB table scans).
 */
export async function listProducts(
  repo: Repository,
  options: {
    status?: ProductStatus;
    limit?: number;
    cursor?: string;
  } = {},
): Promise<{ items: ProductItem[]; cursor?: string }> {
  return repo.queryIndex("GSI1", "GSI1PK", "PRODUCTS", productItemSchema, {
    sortKeyName: "GSI1SK",
    sortKeyPrefix: options.status ? `STATUS#${options.status}` : undefined,
    limit: options.limit ?? 50,
    cursor: options.cursor,
  });
}

/**
 * Fetches a single product and its variants by product ID (slug).
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

  return { product, variants };
}

/**
 * Creates a new product and initialises its bottle size variants atomically
 * with an audit trail entry using DynamoDB TransactWriteItems.
 * Fails atomically if product ID already exists (zero orphan variants or logs).
 */
export async function createProduct(
  repo: Repository,
  audit: AuditService,
  actorEmail: string,
  rawInput: ProductCreateInput,
): Promise<ProductWithVariants> {
  const input = productCreateInputSchema.parse(rawInput);
  const now = new Date().toISOString();

  const productItem: ProductItem = {
    pk: keys.product(input.id).pk,
    sk: keys.product(input.id).sk,
    entityType: ENTITY.product,
    id: input.id,
    name: input.name,
    description: input.description,
    category: input.category,
    status: input.status,
    sizes: input.sizes,
    imageKey: input.imageKey,
    imageAlt: input.imageAlt,
    concentration: input.concentration,
    gender: input.gender,
    featured: input.featured ?? false,
    bestseller: input.bestseller ?? false,
    GSI1PK: "PRODUCTS",
    GSI1SK: keys.productGsi1(input.status, input.id).GSI1SK,
    GSI2PK: keys.productGsi2(input.category, input.id).GSI2PK,
    GSI2SK: keys.productGsi2(input.category, input.id).GSI2SK,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  const variants: ProductVariantItem[] = [];
  const variantInputMap = new Map((input.variants ?? []).map((v) => [v.sizeMl, v]));

  for (const size of input.sizes) {
    const vInput = variantInputMap.get(size);
    const priceInr = vInput?.priceInr ?? STANDARD_PRICES_INR[size];
    const sku = vInput?.sku ?? `LUF-${input.id.toUpperCase()}-${size}ML`;

    const variantKey = keys.variant(input.id, size);
    const variantItem: ProductVariantItem = {
      pk: variantKey.pk,
      sk: variantKey.sk,
      entityType: ENTITY.variant,
      productId: input.id,
      sizeMl: size,
      priceInr,
      mrpInr: vInput?.mrpInr,
      stockQuantity: vInput?.stockQuantity ?? 0,
      sku,
      status: vInput?.status ?? "ACTIVE",
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    variants.push(variantItem);
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
 * Updates a product metadata item and optionally its variants atomically
 * with an audit trail entry. Enforces optimistic concurrency via version check.
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

  const nextProductItem: ProductItem = {
    ...existing.product,
    name: input.name ?? existing.product.name,
    description: input.description === null ? undefined : (input.description ?? existing.product.description),
    category: nextCategory,
    status: nextStatus,
    sizes: nextSizes,
    imageKey: input.imageKey === null ? undefined : (input.imageKey ?? existing.product.imageKey),
    imageAlt: input.imageAlt === null ? undefined : (input.imageAlt ?? existing.product.imageAlt),
    concentration: input.concentration === null ? undefined : (input.concentration ?? existing.product.concentration),
    gender: input.gender === null ? undefined : (input.gender ?? existing.product.gender),
    featured: input.featured ?? existing.product.featured,
    bestseller: input.bestseller ?? existing.product.bestseller,
    GSI1PK: "PRODUCTS",
    GSI1SK: keys.productGsi1(nextStatus, productId).GSI1SK,
    GSI2PK: keys.productGsi2(nextCategory, productId).GSI2PK,
    GSI2SK: keys.productGsi2(nextCategory, productId).GSI2SK,
    updatedAt: now,
    version: input.version + 1,
  };

  const existingVariantMap = new Map(existing.variants.map((v) => [v.sizeMl, v]));
  const updatedVariants: ProductVariantItem[] = [];
  const variantOps: TransactOperation[] = [];

  if (input.variants && input.variants.length > 0) {
    for (const vInput of input.variants) {
      const existingVariant = existingVariantMap.get(vInput.sizeMl);
      const variantKey = keys.variant(productId, vInput.sizeMl);

      if (existingVariant) {
        const nextPrice = vInput.priceInr ?? existingVariant.priceInr;
        const nextStock = vInput.stockQuantity ?? existingVariant.stockQuantity;
        const nextStatus = vInput.status ?? existingVariant.status;
        const nextSku = vInput.sku ?? existingVariant.sku;

        const replaced: ProductVariantItem = {
          ...existingVariant,
          priceInr: nextPrice,
          mrpInr: vInput.mrpInr ?? existingVariant.mrpInr,
          stockQuantity: nextStock,
          sku: nextSku,
          status: nextStatus,
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
          sizeMl: vInput.sizeMl,
          priceInr: vInput.priceInr ?? STANDARD_PRICES_INR[vInput.sizeMl as BottleSizeMl],
          mrpInr: vInput.mrpInr,
          stockQuantity: vInput.stockQuantity ?? 0,
          sku: vInput.sku ?? `LUF-${productId.toUpperCase()}-${vInput.sizeMl}ML`,
          status: vInput.status ?? "ACTIVE",
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

  // Atomic transaction: Product update + all variant updates + audit log
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
