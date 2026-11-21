import "server-only";

/**
 * Excel product import: server side (preview and apply).
 *
 * Safety:
 *   - The server never parses files: the browser sends the rows, which are
 *     validated again here with the same rules.
 *   - Apply re-builds the plan from the same rows against the CURRENT database
 *     and refuses if it differs from the plan the admin confirmed (fingerprint),
 *     e.g. a product was edited in between.
 *   - Each product is written atomically by the existing product services
 *     (product + variants + audit in one DynamoDB transaction, version-checked).
 *   - DynamoDB transactions hold at most 100 items, so the whole file cannot be
 *     one transaction: if any product fails, the products already written by
 *     this import are rolled back (created ones deleted, updated ones restored
 *     to their previous values), and the result says exactly what happened.
 */
import { AuditService } from "@/lib/db/audit";
import { createProduct, getProductWithVariants, listAllProductsWithVariants, updateProduct, deleteProduct, type ProductWithVariants } from "@/lib/db/products-service";
import { listProductTypes } from "@/lib/db/product-types-service";
import { Repository, type TransactOperation } from "@/lib/db/repository";
import { auditEntrySchema, productItemSchema, productVariantItemSchema, type ProductTypeItem, type ProductVariantItem } from "@/lib/db/schemas";
import { planImport, validateRows, type ImportPlan, type ImportRequest, type PlannedProduct } from "./excel-import";

export interface ImportContext {
  existing: ProductWithVariants[];
  productTypes: ProductTypeItem[];
}

export async function loadImportContext(repo: Repository): Promise<ImportContext> {
  const [existing, productTypes] = await Promise.all([listAllProductsWithVariants(repo), listProductTypes(repo)]);
  return { existing, productTypes };
}

export function buildPlan(request: ImportRequest, ctx: ImportContext): ImportPlan {
  const validation = validateRows(request.rows, { typeMap: request.typeMap, productTypes: ctx.productTypes, titleCaseNames: request.titleCaseNames });
  return planImport(validation, ctx.existing, request.options);
}

export interface AppliedProduct {
  productId: string;
  name: string;
  action: "created" | "updated";
  variantsCreated: number;
  variantsUpdated: number;
}

export interface ImportResult {
  status: "completed" | "rolled_back" | "changed_since_preview" | "nothing_to_import";
  importId: string;
  applied: AppliedProduct[];
  /** Set when a product failed: which one and why (admin-readable). */
  failure?: { productId: string; name: string; message: string };
  /** Products that could not be restored automatically during a rollback (should be empty). */
  rollbackProblems: { productId: string; message: string }[];
  plan: ImportPlan;
}

type Snapshot = { kind: "created"; productId: string; name: string } | { kind: "updated"; productId: string; name: string; before: ProductWithVariants; createdVariantIds: string[] };

/** Applies a confirmed plan. Never throws for data problems: the result describes success, refusal or rollback. */
export async function applyImport(
  repo: Repository,
  audit: AuditService,
  actorEmail: string,
  request: ImportRequest,
  confirmedFingerprint: string,
  ctx?: ImportContext,
): Promise<ImportResult> {
  const context = ctx ?? (await loadImportContext(repo));
  const plan = buildPlan(request, context);
  const importId = `imp_${Date.now().toString(36)}`;
  const base = { importId, applied: [] as AppliedProduct[], rollbackProblems: [], plan };
  if (plan.fingerprint !== confirmedFingerprint) return { ...base, status: "changed_since_preview" };

  const work = plan.products.filter((p) => p.action === "create" || p.action === "update");
  if (work.length === 0) return { ...base, status: "nothing_to_import" };

  const done: Snapshot[] = [];
  const applied: AppliedProduct[] = [];
  for (const p of work) {
    try {
      if (p.action === "create") {
        await createImportedProduct(repo, audit, actorEmail, p);
        done.push({ kind: "created", productId: p.productId, name: p.name });
        applied.push({ productId: p.productId, name: p.name, action: "created", variantsCreated: p.variants.length, variantsUpdated: 0 });
      } else {
        const before = await updateImportedProduct(repo, audit, actorEmail, p);
        done.push({ kind: "updated", productId: p.productId, name: p.name, before, createdVariantIds: p.variants.filter((v) => v.action === "create").map((v) => v.variantId) });
        applied.push({
          productId: p.productId, name: p.name, action: "updated",
          variantsCreated: p.variants.filter((v) => v.action === "create").length, variantsUpdated: p.variants.filter((v) => v.action === "update").length,
        });
      }
    } catch (e) {
      const rollbackProblems = await rollback(repo, audit, actorEmail, importId, done);
      await audit
        .record({ actorEmail, action: "product.import_rollback", targetType: "PRODUCT", targetId: importId, summary: `Excel import ${importId} stopped at ${p.name} and was rolled back (${done.length} product(s) undone${rollbackProblems.length ? `, ${rollbackProblems.length} could not be undone` : ""})` })
        .catch(() => undefined);
      return { ...base, status: "rolled_back", failure: { productId: p.productId, name: p.name, message: friendlyError(e) }, rollbackProblems };
    }
  }

  await audit
    .record({
      actorEmail, action: "product.import", targetType: "PRODUCT", targetId: importId,
      summary: `Excel import ${importId}: ${plan.totals.newProducts} new product(s), ${plan.totals.newVariants} new variant(s), ${plan.totals.existingProductsAffected} existing product(s) updated`,
    })
    .catch(() => undefined);
  return { ...base, status: "completed", applied };
}

function friendlyError(e: unknown): string {
  const name = (e as { name?: string })?.name ?? "";
  if (/Conditional|TransactionCanceled|Conflict/i.test(name) || /Version mismatch|already exists|conditional/i.test(String((e as Error)?.message))) {
    return "This product was changed or created by someone else while the import was running.";
  }
  return "The database rejected the change.";
}

async function createImportedProduct(repo: Repository, audit: AuditService, actorEmail: string, p: PlannedProduct): Promise<void> {
  await createProduct(repo, audit, actorEmail, {
    id: p.productId,
    name: p.name,
    productTypeId: p.productTypeId,
    productTypeName: p.productTypeName,
    category: p.category,
    status: p.status,
    notesEnabled: true,
    sizes: p.sizes.length ? p.sizes : [p.variants[0].capacity],
    notes: p.notes ?? { top: [], heart: [], base: [] },
    variants: p.variants.map((v) => ({
      id: v.variantId, capacity: v.capacity, unit: v.unit, label: v.label, priceInr: v.priceInr, stockQuantity: v.stockQuantity, sku: v.sku, status: "ACTIVE", sortOrder: v.sortOrder,
    })),
  });
}

const variantId = (v: ProductVariantItem) => v.id ?? v.sk.replace("VARIANT#", "");

/** Updates an existing product with the planned changes; returns the state before the update (for rollback). */
async function updateImportedProduct(repo: Repository, audit: AuditService, actorEmail: string, p: PlannedProduct): Promise<ProductWithVariants> {
  const before = await getProductWithVariants(repo, p.productId);
  if (!before || before.product.version !== p.existingVersion) throw Object.assign(new Error("Version mismatch"), { name: "ConflictError" });
  const plannedById = new Map(p.variants.map((v) => [v.variantId, v]));
  // updateProduct archives variants left out of the list, so every live variant is passed.
  const variants = before.variants
    .filter((v) => v.status !== "ARCHIVED")
    .map((v) => {
      const planned = plannedById.get(variantId(v));
      if (planned && planned.existingVersion !== v.version) throw Object.assign(new Error("Version mismatch"), { name: "ConflictError" });
      return {
        id: variantId(v), capacity: v.capacity ?? v.sizeMl, unit: v.unit, label: v.label, status: v.status, sortOrder: v.sortOrder, mrpInr: v.mrpInr,
        priceInr: planned ? planned.priceInr : v.priceInr,
        stockQuantity: planned ? planned.stockQuantity : v.stockQuantity,
        sku: planned ? planned.sku : v.sku,
      };
    });
  for (const v of p.variants.filter((x) => x.action === "create")) {
    variants.push({ id: v.variantId, capacity: v.capacity, unit: v.unit, label: v.label, status: "ACTIVE", sortOrder: v.sortOrder, mrpInr: undefined, priceInr: v.priceInr, stockQuantity: v.stockQuantity, sku: v.sku });
  }
  await updateProduct(repo, audit, actorEmail, p.productId, {
    version: p.existingVersion!,
    category: p.category,
    notes: p.notes ?? undefined,
    sizes: p.sizes.length ? p.sizes : undefined,
    variants,
  });
  return before;
}

/** Undoes completed products in reverse order. Returns the products that could not be undone. */
async function rollback(repo: Repository, audit: AuditService, actorEmail: string, importId: string, done: readonly Snapshot[]): Promise<{ productId: string; message: string }[]> {
  const problems: { productId: string; message: string }[] = [];
  for (const s of [...done].reverse()) {
    try {
      if (s.kind === "created") {
        await deleteProduct(repo, audit, actorEmail, s.productId, 1);
      } else {
        await restoreProduct(repo, audit, actorEmail, importId, s);
      }
    } catch (e) {
      problems.push({ productId: s.productId, message: `Could not undo automatically: ${(e as Error).message}. Check this product in Products.` });
    }
  }
  return problems;
}

/** Restores an updated product's previous values atomically (versions keep increasing). */
async function restoreProduct(repo: Repository, audit: AuditService, actorEmail: string, importId: string, s: Extract<Snapshot, { kind: "updated" }>): Promise<void> {
  const current = await getProductWithVariants(repo, s.productId);
  if (!current) throw new Error("product no longer exists");
  const now = new Date().toISOString();
  const currentVariants = new Map(current.variants.map((v) => [variantId(v), v]));
  const ops: TransactOperation[] = [
    { type: "put", item: { ...s.before.product, updatedAt: now, version: current.product.version + 1 }, schema: productItemSchema, condition: "exists_version", expectedVersion: current.product.version },
  ];
  for (const v of s.before.variants) {
    const cur = currentVariants.get(variantId(v));
    if (cur) ops.push({ type: "put", item: { ...v, updatedAt: now, version: cur.version + 1 }, schema: productVariantItemSchema, condition: "exists_version", expectedVersion: cur.version });
  }
  for (const id of s.createdVariantIds) {
    const cur = currentVariants.get(id);
    if (cur) ops.push({ type: "delete", key: { pk: cur.pk, sk: cur.sk }, condition: "exists_version", expectedVersion: cur.version });
  }
  const entry = audit.buildEntry({ actorEmail, action: "product.import_rollback", targetType: "PRODUCT", targetId: s.productId, summary: `Restored ${s.name} after Excel import ${importId} was rolled back` });
  ops.push({ type: "put", item: entry, schema: auditEntrySchema, condition: "not_exists" });
  await repo.transactWrite(ops);
}

