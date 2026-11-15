import "server-only";

import { ENTITY, keys } from "./keys";
import { Repository, ConflictError, NotFoundError } from "./repository";
import { AuditService } from "./audit";
import {
  type ProductStatus,
  type ProductTypeCreateInput,
  type ProductTypeItem,
  type ProductTypeUpdateInput,
  productTypeCreateInputSchema,
  productTypeItemSchema,
  productTypeUpdateInputSchema,
  productItemSchema,
  auditEntrySchema,
} from "./schemas";
import type { TransactOperation } from "./repository";

/** Initial standard product types for seeding */
export const INITIAL_PRODUCT_TYPES: ProductTypeCreateInput[] = [
  {
    id: "perfume-spray",
    name: "Perfume Spray",
    description: "Classic fine fragrance spray in glass bottle",
    defaultUnit: "ml",
    hasNotes: true,
    status: "ACTIVE",
    sortOrder: 1,
  },
  {
    id: "roll-on",
    name: "Roll-On",
    description: "Pocket-sized concentrated perfume oil roll-on",
    defaultUnit: "ml",
    hasNotes: true,
    status: "ACTIVE",
    sortOrder: 2,
  },
  {
    id: "air-freshener",
    name: "Air Freshener",
    description: "Atmospheric scenting spray and diffuser",
    defaultUnit: "ml",
    hasNotes: false,
    status: "ACTIVE",
    sortOrder: 3,
  },
  {
    id: "attar",
    name: "Attar",
    description: "Traditional concentrated non-alcoholic perfume oil",
    defaultUnit: "ml",
    hasNotes: true,
    status: "ACTIVE",
    sortOrder: 4,
  },
];

/**
 * Checks whether any products reference a product type using GSI2 index queries.
 * AVOIDS DynamoDB table scans by performing indexed GSI queries with Limit: 1.
 */
export async function isProductTypeInUse(
  repo: Repository,
  typeId: string,
  typeName: string,
): Promise<{ inUse: boolean; sampleSlug?: string }> {
  // Query GSI2 on CATEGORY#<typeName>
  const byCategoryName = await repo.queryIndex(
    "GSI2",
    "GSI2PK",
    `CATEGORY#${typeName}`,
    productItemSchema,
    { limit: 1 },
  );
  if (byCategoryName.items.length > 0) {
    return { inUse: true, sampleSlug: byCategoryName.items[0].id };
  }

  // Also query GSI2 on CATEGORY#<typeId> in case slug was stored as category
  if (typeId !== typeName) {
    const byCategoryId = await repo.queryIndex(
      "GSI2",
      "GSI2PK",
      `CATEGORY#${typeId}`,
      productItemSchema,
      { limit: 1 },
    );
    if (byCategoryId.items.length > 0) {
      return { inUse: true, sampleSlug: byCategoryId.items[0].id };
    }
  }

  return { inUse: false };
}

/**
 * Lists product types from the PRODUCT_TYPES partition.
 * Zero table scans: performs a targeted partition query.
 */
export async function listProductTypes(
  repo: Repository,
  options?: { status?: ProductStatus },
): Promise<ProductTypeItem[]> {
  const { items } = await repo.query("PRODUCT_TYPES", productTypeItemSchema, {
    skPrefix: "TYPE#",
  });

  let filtered = items;
  if (options?.status) {
    filtered = items.filter((t: ProductTypeItem) => t.status === options.status);
  }

  return filtered.sort((a: ProductTypeItem, b: ProductTypeItem) => a.sortOrder - b.sortOrder);
}

/** Retrieves a single product type by its slug ID */
export async function getProductType(
  repo: Repository,
  id: string,
): Promise<ProductTypeItem | null> {
  return repo.get(keys.productType(id), productTypeItemSchema);
}

/** Creates a new product type */
export async function createProductType(
  repo: Repository,
  audit: AuditService,
  actorEmail: string,
  rawInput: ProductTypeCreateInput,
): Promise<ProductTypeItem> {
  const input = productTypeCreateInputSchema.parse(rawInput);
  const now = new Date().toISOString();

  const item: ProductTypeItem = {
    pk: keys.productType(input.id).pk,
    sk: keys.productType(input.id).sk,
    entityType: ENTITY.productType,
    id: input.id,
    name: input.name,
    description: input.description,
    defaultUnit: input.defaultUnit,
    hasNotes: input.hasNotes,
    status: input.status,
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  const auditEntry = audit.buildEntry({
    actorEmail,
    action: "product_type.create",
    targetType: "PRODUCT_TYPE",
    targetId: input.id,
    summary: `Created product type ${input.name} (${input.id})`,
  });

  const operations: TransactOperation[] = [
    { type: "put", item, schema: productTypeItemSchema, condition: "not_exists" },
    { type: "put", item: auditEntry, schema: auditEntrySchema, condition: "not_exists" },
  ];

  await repo.transactWrite(operations);
  return item;
}

/** Updates a product type with optimistic concurrency */
export async function updateProductType(
  repo: Repository,
  audit: AuditService,
  actorEmail: string,
  id: string,
  rawInput: ProductTypeUpdateInput,
): Promise<ProductTypeItem> {
  const input = productTypeUpdateInputSchema.parse(rawInput);
  const existing = await getProductType(repo, id);
  if (!existing) throw new NotFoundError(`Product type ${id} not found`);

  const now = new Date().toISOString();
  const nextItem: ProductTypeItem = {
    ...existing,
    name: input.name ?? existing.name,
    description: input.description === null ? undefined : (input.description ?? existing.description),
    defaultUnit: input.defaultUnit ?? existing.defaultUnit,
    hasNotes: input.hasNotes ?? existing.hasNotes,
    status: input.status ?? existing.status,
    sortOrder: input.sortOrder ?? existing.sortOrder,
    updatedAt: now,
    version: input.version + 1,
  };

  const auditEntry = audit.buildEntry({
    actorEmail,
    action: "product_type.update",
    targetType: "PRODUCT_TYPE",
    targetId: id,
    summary: `Updated product type ${nextItem.name} (${id}) to version ${nextItem.version}`,
  });

  const operations: TransactOperation[] = [
    {
      type: "put",
      item: nextItem,
      schema: productTypeItemSchema,
      condition: "exists_version",
      expectedVersion: input.version,
    },
    { type: "put", item: auditEntry, schema: auditEntrySchema, condition: "not_exists" },
  ];

  await repo.transactWrite(operations);
  return nextItem;
}

/**
 * Deletes a product type after verifying zero active/existing products use it.
 * Zero table scans: uses GSI2 query for reference validation.
 */
export async function deleteProductType(
  repo: Repository,
  audit: AuditService,
  actorEmail: string,
  id: string,
  expectedVersion?: number,
): Promise<void> {
  const existing = await getProductType(repo, id);
  if (!existing) throw new NotFoundError(`Product type ${id} not found`);

  // Protect against deleting types in use by products (Zero table scans!)
  const usage = await isProductTypeInUse(repo, id, existing.name);
  if (usage.inUse) {
    throw new ConflictError(
      `Cannot delete product type "${existing.name}" because product "${usage.sampleSlug}" is assigned to it. Deactivate the product type instead.`,
    );
  }

  const auditEntry = audit.buildEntry({
    actorEmail,
    action: "product_type.delete",
    targetType: "PRODUCT_TYPE",
    targetId: id,
    summary: `Deleted product type ${existing.name} (${id})`,
  });

  const operations: TransactOperation[] = [
    {
      type: "delete",
      key: keys.productType(id),
      condition: expectedVersion !== undefined ? "exists_version" : "exists",
      expectedVersion,
    },
    { type: "put", item: auditEntry, schema: auditEntrySchema, condition: "not_exists" },
  ];

  await repo.transactWrite(operations);
}

/**
 * Idempotently seeds initial product types.
 * NEVER overwrites administrator modifications: puts with condition "not_exists".
 */
export async function seedInitialProductTypes(
  repo: Repository,
): Promise<{ seeded: string[]; existing: string[] }> {
  const seeded: string[] = [];
  const existing: string[] = [];

  for (const t of INITIAL_PRODUCT_TYPES) {
    const key = keys.productType(t.id);
    const existingItem = await repo.get(key, productTypeItemSchema);
    if (existingItem) {
      existing.push(t.id);
      continue;
    }

    const now = new Date().toISOString();
    const item: ProductTypeItem = {
      pk: key.pk,
      sk: key.sk,
      entityType: ENTITY.productType,
      id: t.id,
      name: t.name,
      description: t.description,
      defaultUnit: t.defaultUnit ?? "ml",
      hasNotes: t.hasNotes ?? true,
      status: t.status ?? "ACTIVE",
      sortOrder: t.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    try {
      await repo.create(item, productTypeItemSchema);
      seeded.push(t.id);
    } catch {
      // If another worker or admin created it concurrently, treat as existing
      existing.push(t.id);
    }
  }

  return { seeded, existing };
}
