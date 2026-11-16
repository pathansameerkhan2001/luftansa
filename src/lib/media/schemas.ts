/** Media Library records (pk MEDIA#<id>, sk META; listed through the existing GSI1). */
import { z } from "zod";
import { ENTITY } from "@/lib/db/keys";
import { baseItemSchema, idSchema, isoDateTimeSchema } from "@/lib/db/schemas";

export const MEDIA_KINDS = ["image", "video"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_STATUSES = ["ACTIVE", "PENDING_DELETION"] as const;

export const mediaItemSchema = baseItemSchema.extend({
  entityType: z.literal(ENTITY.media),
  id: idSchema,
  key: z.string().min(1).max(512),
  kind: z.enum(MEDIA_KINDS),
  contentType: z.string().min(1).max(100),
  sizeBytes: z.number().int().min(0),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
  durationSeconds: z.number().positive().max(36000).optional(),
  originalFilename: z.string().min(1).max(200),
  /** Upload destination, e.g. "general", "hero" or "products/<slug>/gallery". */
  folder: z.string().min(1).max(128),
  alt: z.string().max(300).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(MEDIA_STATUSES),
  uploadedBy: z.string().max(254),
  deletionRequestedAt: isoDateTimeSchema.optional(),
  deletionRequestedBy: z.string().max(254).optional(),
  GSI1PK: z.literal("MEDIA"),
  GSI1SK: z.string().min(1).max(256),
});
export type MediaItem = z.infer<typeof mediaItemSchema>;

export const mediaMetaInputSchema = z.object({
  version: z.number().int().min(1),
  alt: z.string().trim().max(300).optional(),
  description: z.string().trim().max(1000).optional(),
});
