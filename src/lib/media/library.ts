/**
 * Media Library service (repository and storage are injected; no I/O of its own).
 *
 * Safety rules:
 *   - Removing an image from a product or section only removes the reference.
 *     Objects are never deleted automatically.
 *   - Deletion is explicit and two-step: request (refused while the asset is
 *     in use) -> confirm (usage re-checked, then the object and its record are
 *     deleted). Every step is audited.
 */
import { randomUUID } from "node:crypto";
import type { AuditService } from "@/lib/db/audit";
import { ENTITY, keys } from "@/lib/db/keys";
import { ConflictError, NotFoundError, ValidationError, type Repository } from "@/lib/db/repository";
import { listAllProductsWithVariants } from "@/lib/db/products-service";
import type { ProductItem } from "@/lib/db/schemas";
import { listEntries } from "@/lib/cms/service";
import type { CmsModuleDefinition } from "@/lib/cms/schemas";
import { mediaItemSchema, type MediaItem, type MediaKind } from "./schemas";
import type { MediaStorage } from "./storage";

export interface MediaContext {
  repo: Repository;
  audit: AuditService;
  actorEmail: string;
  now?: () => Date;
}

export interface UsageRef {
  type: "product" | "content";
  id: string;
  label: string;
  field: string;
}

export interface RegisterInput {
  key: string;
  kind: MediaKind;
  contentType: string;
  sizeBytes: number;
  originalFilename: string;
  folder: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  alt?: string;
}

async function record(ctx: MediaContext, verb: string, item: Pick<MediaItem, "id" | "key">, summary: string) {
  await ctx.audit.record({ actorEmail: ctx.actorEmail, action: `media.${verb}`, targetType: "media", targetId: item.id, summary: `${summary}: ${item.key}`.slice(0, 500) });
}

export async function registerMedia(ctx: MediaContext, input: RegisterInput): Promise<MediaItem> {
  const at = ctx.now?.() ?? new Date();
  const ts = at.toISOString();
  const id = randomUUID().replace(/-/g, "").slice(0, 20);
  const item: MediaItem = {
    ...keys.media(id),
    ...keys.mediaGsi1(ts, id),
    entityType: ENTITY.media,
    id,
    key: input.key,
    kind: input.kind,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    ...(input.width ? { width: Math.round(input.width) } : {}),
    ...(input.height ? { height: Math.round(input.height) } : {}),
    ...(input.durationSeconds ? { durationSeconds: input.durationSeconds } : {}),
    originalFilename: input.originalFilename.slice(0, 200) || "file",
    folder: input.folder,
    ...(input.alt ? { alt: input.alt } : {}),
    status: "ACTIVE",
    uploadedBy: ctx.actorEmail,
    createdAt: ts,
    updatedAt: ts,
    version: 1,
  };
  const created = await ctx.repo.create(item, mediaItemSchema);
  await record(ctx, "upload", created, "Uploaded");
  return created;
}

/** Every registered asset, newest first. */
export async function listMedia(repo: Repository): Promise<MediaItem[]> {
  const out: MediaItem[] = [];
  let cursor: string | undefined;
  do {
    const page = await repo.queryIndex("GSI1", "GSI1PK", "MEDIA", mediaItemSchema, { limit: 100, cursor, scanIndexForward: false });
    out.push(...page.items);
    cursor = page.cursor;
  } while (cursor);
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getMedia(repo: Repository, id: string): Promise<MediaItem | null> {
  return repo.get(keys.media(id), mediaItemSchema);
}

/* ------------------------------------------------------------------ usage --- */

/** Storage keys referenced by a product, with the field they appear in. */
export function productKeyRefs(product: ProductItem): { key: string; field: string }[] {
  const refs: { key: string; field: string }[] = [];
  if (product.mainImageKey) refs.push({ key: product.mainImageKey, field: "Main image" });
  if (product.imageKey && product.imageKey !== product.mainImageKey) refs.push({ key: product.imageKey, field: "Image" });
  (product.galleryImageKeys ?? []).forEach((k, i) => refs.push({ key: k, field: `Gallery image ${i + 1}` }));
  for (const tier of ["top", "heart", "base"] as const) {
    for (const n of product.notes?.[tier] ?? []) if (n.imageKey) refs.push({ key: n.imageKey, field: `${tier} note “${n.name}”` });
  }
  return refs.filter((r) => !/^https?:\/\//.test(r.key));
}

function payloadReferences(value: unknown, key: string): boolean {
  if (typeof value === "string") return value === key || value.endsWith(`/media/${key}`) || value === `/media/${key}`;
  if (Array.isArray(value)) return value.some((v) => payloadReferences(v, key));
  if (value && typeof value === "object") return Object.values(value).some((v) => payloadReferences(v, key));
  return false;
}

/** Where an object key is used: products (main, gallery, notes) and CMS entries (draft or published). */
export async function findUsage(repo: Repository, key: string, modules: readonly CmsModuleDefinition[]): Promise<UsageRef[]> {
  const refs: UsageRef[] = [];
  for (const { product } of await listAllProductsWithVariants(repo)) {
    for (const r of productKeyRefs(product)) {
      if (r.key === key) refs.push({ type: "product", id: product.id, label: product.name, field: r.field });
    }
  }
  for (const def of modules) {
    for (const entry of await listEntries(repo, def)) {
      const inDraft = payloadReferences(entry.draft, key);
      const inPublished = payloadReferences(entry.published, key);
      if (inDraft || inPublished) {
        refs.push({ type: "content", id: `${def.id}/${entry.id}`, label: def.label, field: inPublished ? "Published content" : "Draft content" });
      }
    }
  }
  return refs;
}

/** Product images that exist in product records but are not yet catalogued in the library. */
export async function listUncataloguedProductImages(repo: Repository, registered: readonly MediaItem[]) {
  const known = new Set(registered.map((m) => m.key));
  const out = new Map<string, { key: string; usedBy: UsageRef[] }>();
  for (const { product } of await listAllProductsWithVariants(repo)) {
    for (const r of productKeyRefs(product)) {
      if (known.has(r.key)) continue;
      const entry = out.get(r.key) ?? { key: r.key, usedBy: [] };
      entry.usedBy.push({ type: "product", id: product.id, label: product.name, field: r.field });
      out.set(r.key, entry);
    }
  }
  return [...out.values()];
}

/* ---------------------------------------------------------------- editing --- */

export async function updateMediaMeta(ctx: MediaContext, id: string, input: { alt?: string; description?: string }, expectedVersion: number): Promise<MediaItem> {
  const item = await getMedia(ctx.repo, id);
  if (!item) throw new NotFoundError("Media not found");
  const next: MediaItem = { ...item };
  if (input.alt !== undefined) {
    if (input.alt) next.alt = input.alt;
    else delete next.alt;
  }
  if (input.description !== undefined) {
    if (input.description) next.description = input.description;
    else delete next.description;
  }
  const saved = await ctx.repo.replace(next, mediaItemSchema, expectedVersion);
  await record(ctx, "update", saved, "Updated details");
  return saved;
}

/* --------------------------------------------------------------- deletion --- */

export class MediaInUseError extends Error {
  constructor(public readonly usage: UsageRef[]) {
    super("Media is in use");
  }
}

/** Step 1: mark for deletion. Refused while the asset is referenced anywhere. */
export async function requestDeletion(ctx: MediaContext, id: string, expectedVersion: number, modules: readonly CmsModuleDefinition[]): Promise<MediaItem> {
  const item = await getMedia(ctx.repo, id);
  if (!item) throw new NotFoundError("Media not found");
  if (item.status === "PENDING_DELETION") throw new ConflictError("Deletion already requested");
  const usage = await findUsage(ctx.repo, item.key, modules);
  if (usage.length > 0) throw new MediaInUseError(usage);
  const saved = await ctx.repo.replace(
    { ...item, status: "PENDING_DELETION", deletionRequestedAt: (ctx.now?.() ?? new Date()).toISOString(), deletionRequestedBy: ctx.actorEmail },
    mediaItemSchema,
    expectedVersion,
  );
  await record(ctx, "deletion_requested", saved, "Deletion requested");
  return saved;
}

export async function cancelDeletion(ctx: MediaContext, id: string, expectedVersion: number): Promise<MediaItem> {
  const item = await getMedia(ctx.repo, id);
  if (!item) throw new NotFoundError("Media not found");
  if (item.status !== "PENDING_DELETION") throw new ValidationError([{ path: "status", message: "No deletion is pending" }]);
  const next: MediaItem = { ...item, status: "ACTIVE" };
  delete next.deletionRequestedAt;
  delete next.deletionRequestedBy;
  const saved = await ctx.repo.replace(next, mediaItemSchema, expectedVersion);
  await record(ctx, "deletion_cancelled", saved, "Deletion cancelled");
  return saved;
}

/** Step 2: permanently delete the object and its record (usage re-checked first). */
export async function confirmDeletion(
  ctx: MediaContext,
  storage: MediaStorage,
  id: string,
  expectedVersion: number,
  modules: readonly CmsModuleDefinition[],
): Promise<void> {
  const item = await getMedia(ctx.repo, id);
  if (!item) throw new NotFoundError("Media not found");
  if (item.status !== "PENDING_DELETION") throw new ValidationError([{ path: "status", message: "Request deletion first" }]);
  if (item.version !== expectedVersion) throw new ConflictError("Version mismatch");
  const usage = await findUsage(ctx.repo, item.key, modules);
  if (usage.length > 0) throw new MediaInUseError(usage);
  await storage.remove(item.key);
  await ctx.repo.remove(keys.media(id), expectedVersion);
  await record(ctx, "deleted", item, "Permanently deleted");
}
