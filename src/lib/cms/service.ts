/**
 * CMS entry service (no I/O of its own: the repository is injected, so tests
 * use the in-memory DynamoDB fake and local development uses DynamoDB Local).
 *
 * Every write:
 *   - validates the payload with the module's schema;
 *   - uses optimistic concurrency (expected version), so two administrators
 *     can never silently overwrite each other;
 *   - writes one audit entry.
 * Route handlers revalidate the storefront after a successful write.
 */
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type { AuditService } from "@/lib/db/audit";
import { ENTITY, keys, SK_PREFIX } from "@/lib/db/keys";
import { ConflictError, NotFoundError, ValidationError, type Repository, type TransactOperation } from "@/lib/db/repository";
import {
  contentEntrySchema,
  entryCreateInputSchema,
  entrySettingsInputSchema,
  SINGLETON_ID,
  type CmsModuleDefinition,
  type ContentEntry,
  type EntryCreateInput,
  type EntrySettingsInput,
} from "./schemas";

export interface CmsContext {
  repo: Repository;
  audit: AuditService;
  actorEmail: string;
  now?: () => Date;
}

const DEFAULT_VISIBILITY = { desktop: true, mobile: true } as const;

function validatePayload(def: CmsModuleDefinition, payload: unknown): Record<string, unknown> {
  const parsed = (def.payload as z.ZodType<Record<string, unknown>>).safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => ({ path: ["draft", ...i.path].join("."), message: i.message })));
  }
  return parsed.data;
}

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ValidationError(parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  return parsed.data;
}

async function record(ctx: CmsContext, verb: string, def: CmsModuleDefinition, id: string, summary: string) {
  await ctx.audit.record({ actorEmail: ctx.actorEmail, action: `cms.${verb}`, targetType: "content", targetId: `${def.id}/${id}`, summary });
}

/** All entries of a module, in display order (then id). */
export async function listEntries(repo: Repository, def: CmsModuleDefinition): Promise<ContentEntry[]> {
  const pk = keys.contentPartition(def.id);
  const out: ContentEntry[] = [];
  let cursor: string | undefined;
  do {
    const page = await repo.query(pk, contentEntrySchema, { skPrefix: SK_PREFIX.contentEntry, limit: 100, cursor });
    out.push(...page.items);
    cursor = page.cursor;
  } while (cursor);
  return out.sort((a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id));
}

export async function getEntry(repo: Repository, def: CmsModuleDefinition, id: string): Promise<ContentEntry | null> {
  return repo.get(keys.contentEntry(def.id, id), contentEntrySchema);
}

async function requireEntry(repo: Repository, def: CmsModuleDefinition, id: string): Promise<ContentEntry> {
  const entry = await getEntry(repo, def, id);
  if (!entry) throw new NotFoundError("Entry not found");
  return entry;
}

export async function createEntry(ctx: CmsContext, def: CmsModuleDefinition, input: EntryCreateInput): Promise<ContentEntry> {
  const data = parseInput(entryCreateInputSchema, input);
  const draft = validatePayload(def, data.draft);
  const existing = await listEntries(ctx.repo, def);
  if (def.kind === "singleton" && existing.length > 0) throw new ConflictError("This section already exists");
  if (def.maxEntries !== undefined && existing.length >= def.maxEntries) {
    throw new ValidationError([{ path: "entries", message: `At most ${def.maxEntries} entries are allowed` }]);
  }
  const id = def.kind === "singleton" ? SINGLETON_ID : (data.id ?? randomUUID().replace(/-/g, "").slice(0, 16));
  const ts = (ctx.now?.() ?? new Date()).toISOString();
  const nextOrder = existing.length === 0 ? 0 : Math.max(...existing.map((e) => e.displayOrder)) + 1;
  const item: ContentEntry = {
    ...keys.contentEntry(def.id, id),
    entityType: ENTITY.content,
    module: def.id,
    id,
    status: "DRAFT",
    displayOrder: data.displayOrder ?? nextOrder,
    visibility: data.visibility ?? { ...DEFAULT_VISIBILITY },
    ...(data.schedule ? { schedule: data.schedule } : {}),
    draft,
    hasUnpublishedChanges: true,
    updatedBy: ctx.actorEmail,
    createdAt: ts,
    updatedAt: ts,
    version: 1,
  };
  const created = await ctx.repo.create(item, contentEntrySchema);
  await record(ctx, "create", def, id, `Created ${def.label} entry (draft)`);
  return created;
}

/** Saves the draft only; the storefront keeps showing the published payload. */
export async function saveDraft(ctx: CmsContext, def: CmsModuleDefinition, id: string, draft: unknown, expectedVersion: number): Promise<ContentEntry> {
  const entry = await requireEntry(ctx.repo, def, id);
  const valid = validatePayload(def, draft);
  const changed = JSON.stringify(valid) !== JSON.stringify(entry.published ?? null);
  const saved = await ctx.repo.replace(
    { ...entry, draft: valid, hasUnpublishedChanges: entry.status !== "PUBLISHED" ? true : changed, updatedBy: ctx.actorEmail },
    contentEntrySchema,
    expectedVersion,
  );
  await record(ctx, "save_draft", def, id, `Saved ${def.label} draft`);
  return saved;
}

/** Order / visibility / schedule. These apply immediately (they arrange, not author, content). */
export async function updateSettings(ctx: CmsContext, def: CmsModuleDefinition, id: string, input: EntrySettingsInput, expectedVersion: number): Promise<ContentEntry> {
  const data = parseInput(entrySettingsInputSchema, input);
  const entry = await requireEntry(ctx.repo, def, id);
  const next: ContentEntry = { ...entry, updatedBy: ctx.actorEmail };
  if (data.displayOrder !== undefined) next.displayOrder = data.displayOrder;
  if (data.visibility !== undefined) next.visibility = data.visibility;
  if (data.schedule === null) delete next.schedule;
  else if (data.schedule !== undefined) next.schedule = data.schedule;
  const saved = await ctx.repo.replace(next, contentEntrySchema, expectedVersion);
  await record(ctx, "update_settings", def, id, `Updated ${def.label} order/visibility/schedule`);
  return saved;
}

/** Publishes the current draft (re-validated) as the live version. */
export async function publishEntry(ctx: CmsContext, def: CmsModuleDefinition, id: string, expectedVersion: number): Promise<ContentEntry> {
  const entry = await requireEntry(ctx.repo, def, id);
  const valid = validatePayload(def, entry.draft);
  const ts = (ctx.now?.() ?? new Date()).toISOString();
  const saved = await ctx.repo.replace(
    { ...entry, status: "PUBLISHED", published: valid, hasUnpublishedChanges: false, publishedAt: ts, publishedBy: ctx.actorEmail, updatedBy: ctx.actorEmail },
    contentEntrySchema,
    expectedVersion,
  );
  await record(ctx, "publish", def, id, `Published ${def.label} entry`);
  return saved;
}

/** Removes the entry from the storefront; the draft is kept for later. */
export async function unpublishEntry(ctx: CmsContext, def: CmsModuleDefinition, id: string, expectedVersion: number): Promise<ContentEntry> {
  const entry = await requireEntry(ctx.repo, def, id);
  const next: ContentEntry = { ...entry, status: "UNPUBLISHED", hasUnpublishedChanges: true, updatedBy: ctx.actorEmail };
  delete next.published;
  const saved = await ctx.repo.replace(next, contentEntrySchema, expectedVersion);
  await record(ctx, "unpublish", def, id, `Unpublished ${def.label} entry`);
  return saved;
}

/**
 * Applies a new order atomically (one transaction, every entry version-checked).
 * `order` lists every entry of the module exactly once with its current version.
 */
export async function reorderEntries(ctx: CmsContext, def: CmsModuleDefinition, order: readonly { id: string; version: number }[]): Promise<ContentEntry[]> {
  const entries = await listEntries(ctx.repo, def);
  const ids = new Set(order.map((o) => o.id));
  if (ids.size !== order.length || ids.size !== entries.length || entries.some((e) => !ids.has(e.id))) {
    throw new ValidationError([{ path: "order", message: "The order must list every entry exactly once" }]);
  }
  if (order.length > 100) throw new ValidationError([{ path: "order", message: "Too many entries to reorder at once" }]);
  const ts = (ctx.now?.() ?? new Date()).toISOString();
  const byId = new Map(entries.map((e) => [e.id, e]));
  const updated: ContentEntry[] = [];
  const ops: TransactOperation[] = order.map((o, index) => {
    const entry = byId.get(o.id)!;
    const item: ContentEntry = { ...entry, displayOrder: index, version: o.version + 1, updatedAt: ts, updatedBy: ctx.actorEmail };
    updated.push(item);
    return { type: "put", item, schema: contentEntrySchema, condition: "exists_version", expectedVersion: o.version };
  });
  await ctx.repo.transactWrite(ops);
  await record(ctx, "reorder", def, "all", `Reordered ${order.length} ${def.label} entries`);
  return updated;
}

export async function deleteEntry(ctx: CmsContext, def: CmsModuleDefinition, id: string, expectedVersion: number): Promise<void> {
  await requireEntry(ctx.repo, def, id);
  await ctx.repo.remove(keys.contentEntry(def.id, id), expectedVersion);
  await record(ctx, "delete", def, id, `Deleted ${def.label} entry`);
}
