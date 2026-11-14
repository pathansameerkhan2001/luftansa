/**
 * Zod schemas shared by the repository and admin APIs. Every item is
 * validated before it is written and after it is read.
 * Entity-specific schemas (products, orders, …) are added in later phases.
 */
import { z } from "zod";
import { ENTITY } from "./keys";

export const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Invalid identifier");
export const isoDateTimeSchema = z.iso.datetime();
export const emailSchema = z.email().max(254).transform((v) => v.trim().toLowerCase());

/** Attributes common to every stored item. */
export const baseItemSchema = z.object({
  pk: z.string().min(1).max(512),
  sk: z.string().min(1).max(512),
  entityType: z.enum(Object.values(ENTITY) as [string, ...string[]]),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  /** Optimistic-concurrency version, incremented on every write. */
  version: z.number().int().min(1),
});
export type BaseItem = z.infer<typeof baseItemSchema>;

/** Audit trail entry (one per admin write). Never contains tokens or secrets. */
export const auditEntrySchema = baseItemSchema.extend({
  entityType: z.literal(ENTITY.audit),
  actorEmail: z.email().max(254),
  action: z.string().regex(/^[a-z]+(\.[a-z_]+)+$/, "Use dotted lower-case actions, e.g. product.update"),
  targetType: z.string().max(32),
  targetId: z.string().max(128).optional(),
  summary: z.string().max(500),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

/** Input accepted by AuditService.record (server-side callers only). */
export const auditInputSchema = auditEntrySchema.pick({ actorEmail: true, action: true, targetType: true, targetId: true, summary: true });
export type AuditInput = z.infer<typeof auditInputSchema>;
