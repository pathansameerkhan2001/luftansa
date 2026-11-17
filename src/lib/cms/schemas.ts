/**
 * CMS content entries (Phase 3A foundation).
 *
 * One small DynamoDB item per entry (pk CONTENT#<module>, sk ENTRY#<id>), so
 * the website is never stored in one oversized item. Each entry keeps:
 *   draft      the editable payload (validated by the module's schema)
 *   published  the last published payload (what the storefront shows)
 * Order, visibility and schedule are entry settings that apply immediately;
 * content changes reach the storefront only through Publish.
 */
import { z } from "zod";
import { ENTITY } from "@/lib/db/keys";
import { baseItemSchema, idSchema, isoDateTimeSchema } from "@/lib/db/schemas";

export const CMS_STATUSES = ["DRAFT", "PUBLISHED", "UNPUBLISHED"] as const;
export const cmsStatusSchema = z.enum(CMS_STATUSES);
export type CmsStatus = z.infer<typeof cmsStatusSchema>;

export const visibilitySchema = z.object({ desktop: z.boolean(), mobile: z.boolean() });
export type Visibility = z.infer<typeof visibilitySchema>;

export const scheduleSchema = z
  .object({ startAt: isoDateTimeSchema.optional(), endAt: isoDateTimeSchema.optional() })
  .refine((s) => !s.startAt || !s.endAt || s.startAt < s.endAt, { message: "End must be after start", path: ["endAt"] });
export type Schedule = z.infer<typeof scheduleSchema>;

const payloadSchema = z.record(z.string(), z.unknown());
const displayOrderSchema = z.number().int().min(0).max(100000);

export const contentEntrySchema = baseItemSchema.extend({
  entityType: z.literal(ENTITY.content),
  module: idSchema,
  id: idSchema,
  status: cmsStatusSchema,
  displayOrder: displayOrderSchema,
  visibility: visibilitySchema,
  schedule: scheduleSchema.optional(),
  draft: payloadSchema,
  published: payloadSchema.optional(),
  /** True when the draft differs from what is published. */
  hasUnpublishedChanges: z.boolean(),
  updatedBy: z.string().max(254),
  publishedAt: isoDateTimeSchema.optional(),
  publishedBy: z.string().max(254).optional(),
});
export type ContentEntry = z.infer<typeof contentEntrySchema>;

/** A CMS module: its id, kind and the schema every payload must satisfy. */
export interface CmsModuleDefinition<P extends z.ZodType<Record<string, unknown>> = z.ZodType<Record<string, unknown>>> {
  id: string;
  label: string;
  /** "singleton": exactly one entry (id "main"), e.g. Hero. "list": ordered entries. */
  kind: "list" | "singleton";
  payload: P;
  maxEntries?: number;
}

export const SINGLETON_ID = "main";

/** Input accepted when creating an entry. */
export const entryCreateInputSchema = z.object({
  id: idSchema.optional(),
  draft: payloadSchema,
  displayOrder: displayOrderSchema.optional(),
  visibility: visibilitySchema.optional(),
  schedule: scheduleSchema.optional(),
});
export type EntryCreateInput = z.input<typeof entryCreateInputSchema>;

export const entrySettingsInputSchema = z.object({
  displayOrder: displayOrderSchema.optional(),
  visibility: visibilitySchema.optional(),
  schedule: scheduleSchema.nullable().optional(),
});
export type EntrySettingsInput = z.input<typeof entrySettingsInputSchema>;
