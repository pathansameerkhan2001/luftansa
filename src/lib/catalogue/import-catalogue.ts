/**
 * Idempotent import of the legacy hardcoded catalogue into DynamoDB.
 *
 * Safety guarantees:
 * - Only products MISSING from DynamoDB are created. An existing product
 *   (any status) is never modified, overwritten or deleted.
 * - A product whose name already exists under a different slug is reported
 *   as a possible duplicate and skipped.
 * - Each product is written in one transaction (product + variants + audit)
 *   with attribute_not_exists conditions, so a concurrent write or a re-run
 *   cannot create duplicates or overwrite anything.
 * - Planning performs reads only.
 */
import { maskEmail, normalizeEmail, parseAdminEmails } from "../auth/admin-emails";
import { AuditService } from "../db/audit";
import { keys } from "../db/keys";
import { listAllProducts } from "../db/products-service";
import { ConflictError, type Repository } from "../db/repository";
import {
  auditEntrySchema,
  productItemSchema,
  productTypeItemSchema,
  productVariantItemSchema,
  type ProductItem,
} from "../db/schemas";
import { buildLegacyCatalogue, LEGACY_PRODUCT_TYPE_ID, type LegacyCatalogueEntry } from "./legacy-catalogue";

export type ImportAction = "create" | "skip_exists" | "skip_possible_duplicate";

export interface ImportPlanItem {
  slug: string;
  name: string;
  action: ImportAction;
  reason?: string;
  entry: LegacyCatalogueEntry;
}

export interface ImportPlan {
  items: ImportPlanItem[];
  warnings: string[];
  existingProducts: Pick<ProductItem, "id" | "name" | "status">[];
  productTypeName?: string;
}

const normalizeName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

export class UnauthorizedActorError extends Error {}

/**
 * Resolves the audit actor for --apply. The email must be on the configured
 * administrator allow-list (ADMIN_EMAILS, or the ADMIN_EMAIL fallback), using
 * exactly the same parsing and normalisation as the admin login.
 * Returns the normalised email; throws UnauthorizedActorError otherwise.
 * Error messages never reveal the allow-list contents.
 */
export function resolveAuthorizedActor(actor: string | undefined, rawAllowlist: string | undefined): string {
  const allowlist = rawAllowlist?.trim();
  if (!allowlist) {
    throw new UnauthorizedActorError("ADMIN_EMAILS is not configured; refusing to apply without an administrator allow-list.");
  }
  const { emails } = parseAdminEmails(allowlist);
  if (emails.length === 0) {
    throw new UnauthorizedActorError("ADMIN_EMAILS contains no valid email addresses; refusing to apply.");
  }
  if (!actor || !actor.trim()) {
    throw new UnauthorizedActorError("--apply requires --actor <admin email> (recorded in the audit log).");
  }
  const normalized = normalizeEmail(actor);
  if (!emails.includes(normalized)) {
    throw new UnauthorizedActorError(`Actor ${maskEmail(normalized)} is not on the ADMIN_EMAILS allow-list; refusing to apply.`);
  }
  return normalized;
}

export const CONFIRM_PRODUCTION_WRITE_FLAG = "--confirm-production-write";

export type ImportMode = { mode: "dry-run" } | { mode: "apply"; actor: string };

/**
 * Decides whether the import CLI may write (pure; evaluated before any AWS
 * client is created). Writing to production requires ALL of:
 *   --apply
 *   --confirm-production-write
 *   --actor <email> on the ADMIN_EMAILS allow-list (resolveAuthorizedActor)
 * Anything less is a read-only dry run or an error, never a write.
 */
export function resolveImportMode(argv: readonly string[], rawAllowlist: string | undefined): ImportMode {
  const apply = argv.includes("--apply");
  const confirmed = argv.includes(CONFIRM_PRODUCTION_WRITE_FLAG);
  if (!apply && confirmed) {
    throw new UnauthorizedActorError(`${CONFIRM_PRODUCTION_WRITE_FLAG} is only valid together with --apply.`);
  }
  if (!apply) return { mode: "dry-run" };
  if (!confirmed) {
    throw new UnauthorizedActorError(
      `--apply writes to PRODUCTION DynamoDB. Re-run with ${CONFIRM_PRODUCTION_WRITE_FLAG} to confirm (a dry run needs no flags).`,
    );
  }
  const actorIdx = argv.indexOf("--actor");
  const actor = actorIdx >= 0 ? argv[actorIdx + 1] : undefined;
  return { mode: "apply", actor: resolveAuthorizedActor(actor?.startsWith("--") ? undefined : actor, rawAllowlist) };
}

/** Builds the import plan using reads only (GetItem + GSI1 Query). */
export async function planCatalogueImport(repo: Repository, now = new Date().toISOString()): Promise<ImportPlan> {
  const productType = await repo.get(keys.productType(LEGACY_PRODUCT_TYPE_ID), productTypeItemSchema);
  const { entries, warnings } = buildLegacyCatalogue({ now, productTypeName: productType?.name });
  if (!productType) {
    warnings.push(`Product type "${LEGACY_PRODUCT_TYPE_ID}" was not found; productTypeName will be left unset.`);
  }

  const existing = await listAllProducts(repo);
  const byName = new Map(existing.map((p) => [normalizeName(p.name), p]));

  const items: ImportPlanItem[] = [];
  for (const entry of entries) {
    const { id: slug, name } = entry.product;
    // Authoritative, strongly consistent existence check on the base table.
    const current = await repo.get(keys.product(slug), productItemSchema);
    if (current) {
      items.push({ slug, name, action: "skip_exists", reason: `already in DynamoDB (status ${current.status}, version ${current.version})`, entry });
      continue;
    }
    const sameName = byName.get(normalizeName(name));
    if (sameName && sameName.id !== slug) {
      items.push({
        slug,
        name,
        action: "skip_possible_duplicate",
        reason: `a product named "${sameName.name}" already exists as "${sameName.id}"`,
        entry,
      });
      continue;
    }
    items.push({ slug, name, action: "create", entry });
  }

  return {
    items,
    warnings,
    existingProducts: existing.map((p) => ({ id: p.id, name: p.name, status: p.status })),
    productTypeName: productType?.name,
  };
}

export interface ImportResult {
  created: string[];
  skipped: { slug: string; reason: string }[];
}

/** Applies a plan: creates only the "create" items, each atomically. */
export async function applyCatalogueImport(
  repo: Repository,
  audit: AuditService,
  actorEmail: string,
  plan: ImportPlan,
): Promise<ImportResult> {
  const result: ImportResult = { created: [], skipped: [] };
  for (const item of plan.items) {
    if (item.action !== "create") {
      result.skipped.push({ slug: item.slug, reason: item.reason ?? item.action });
      continue;
    }
    const { product, variants } = item.entry;
    const auditEntry = audit.buildEntry({
      actorEmail,
      action: "product.import",
      targetType: "PRODUCT",
      targetId: product.id,
      summary: `Imported legacy catalogue product ${product.name} (${product.id}) with ${variants.length} variants`,
    });
    try {
      await repo.transactWrite([
        { type: "put", item: product, schema: productItemSchema, condition: "not_exists" },
        ...variants.map((v) => ({ type: "put" as const, item: v, schema: productVariantItemSchema, condition: "not_exists" as const })),
        { type: "put", item: auditEntry, schema: auditEntrySchema, condition: "not_exists" },
      ]);
      result.created.push(product.id);
    } catch (e) {
      if (e instanceof ConflictError) {
        result.skipped.push({ slug: product.id, reason: "created concurrently by another writer; left untouched" });
        continue;
      }
      throw e;
    }
  }
  return result;
}
