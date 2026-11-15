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
  action: z.string().regex(/^[a-z_]+(\.[a-z_]+)+$/, "Use dotted lower-case actions, e.g. product.update"),
  targetType: z.string().max(32),
  targetId: z.string().max(128).optional(),
  summary: z.string().max(500),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

/** Input accepted by AuditService.record (server-side callers only). */
export const auditInputSchema = auditEntrySchema.pick({ actorEmail: true, action: true, targetType: true, targetId: true, summary: true });
export type AuditInput = z.infer<typeof auditInputSchema>;

/* -------------------------------------------------------------------------- */
/* Phase 2: Product Types, Product & Variant Schemas                          */
/* -------------------------------------------------------------------------- */

export const PRODUCT_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export const productStatusSchema = z.enum(PRODUCT_STATUSES);
export type ProductStatus = z.infer<typeof productStatusSchema>;

export const VARIANT_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export const variantStatusSchema = z.enum(VARIANT_STATUSES);
export type VariantStatus = z.infer<typeof variantStatusSchema>;

export const PRODUCT_TYPE_UNITS = ["ml", "g", "pieces", "units", "oz"] as const;
export const productTypeUnitSchema = z.enum(PRODUCT_TYPE_UNITS);
export type ProductTypeUnit = z.infer<typeof productTypeUnitSchema>;

/** Product Type stored item (pk: PRODUCT_TYPES, sk: TYPE#<id>) */
export const productTypeItemSchema = baseItemSchema.extend({
  entityType: z.literal(ENTITY.productType),
  id: idSchema, // e.g. "perfume-spray", "roll-on"
  name: z.string().min(2).max(64),
  description: z.string().max(300).optional(),
  defaultUnit: productTypeUnitSchema.default("ml"),
  hasNotes: z.boolean().default(true),
  status: productStatusSchema.default("ACTIVE"),
  sortOrder: z.number().int().default(0),
});
export type ProductTypeItem = z.infer<typeof productTypeItemSchema>;

export const productTypeCreateInputSchema = z.object({
  id: idSchema,
  name: z.string().min(2).max(64),
  description: z.string().max(300).optional(),
  defaultUnit: productTypeUnitSchema.default("ml"),
  hasNotes: z.boolean().default(true),
  status: productStatusSchema.default("ACTIVE"),
  sortOrder: z.number().int().optional().default(0),
});
export type ProductTypeCreateInput = z.input<typeof productTypeCreateInputSchema>;

export const productTypeUpdateInputSchema = z.object({
  version: z.number().int().min(1),
  name: z.string().min(2).max(64).optional(),
  description: z.string().max(300).optional().nullable(),
  defaultUnit: productTypeUnitSchema.optional(),
  hasNotes: z.boolean().optional(),
  status: productStatusSchema.optional(),
  sortOrder: z.number().int().optional(),
});
export type ProductTypeUpdateInput = z.input<typeof productTypeUpdateInputSchema>;

export const BOTTLE_SIZES_ML = [30, 50, 100] as const;
export const bottleSizeSchema = z.union([z.literal(30), z.literal(50), z.literal(100)]);
export type BottleSizeMl = z.infer<typeof bottleSizeSchema>;

/** Confirmed standard pricing (INR) by bottle size */
export const STANDARD_PRICES_INR: Record<BottleSizeMl, number> = {
  30: 400,
  50: 630,
  100: 1000,
};

/** Individual fragrance note with its OWN image and description */
export const fragranceNoteItemSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(64),
  imageKey: z.string().max(512).optional(),
  description: z.string().max(300).optional(),
});
export type FragranceNoteItem = z.infer<typeof fragranceNoteItemSchema>;

/** Three distinct fragrance note groups: Top, Heart and Base (max 10 each) */
export const fragranceNotesSchema = z.object({
  top: z.array(fragranceNoteItemSchema).max(10).default([]),
  heart: z.array(fragranceNoteItemSchema).max(10).default([]),
  base: z.array(fragranceNoteItemSchema).max(10).default([]),
});
export type FragranceNotes = z.infer<typeof fragranceNotesSchema>;

/** Product variant stored item (sk: VARIANT#<variantId>) */
export const productVariantItemSchema = baseItemSchema.extend({
  entityType: z.literal(ENTITY.variant),
  productId: idSchema,
  id: z.string().min(1).max(64).optional(), // Stable unique variant ID e.g. "v_k9f2b8x1" or legacy "00030"
  capacity: z.number().positive().max(10000).optional(),
  unit: productTypeUnitSchema.default("ml"),
  label: z.string().max(64).optional(),
  sizeMl: z.number().optional(), // Legacy fallback for existing data
  priceInr: z.number().int().min(1).max(10000000),
  mrpInr: z.number().int().min(1).max(10000000).optional(),
  stockQuantity: z.number().int().min(0).max(1000000).default(0),
  sku: z.string().min(1).max(64),
  status: variantStatusSchema.default("ACTIVE"),
  sortOrder: z.number().int().default(0),
  archivedAt: z.string().optional(),
});
export type ProductVariantItem = z.infer<typeof productVariantItemSchema>;

/** Product metadata stored item (sk: META) */
export const productItemSchema = baseItemSchema.extend({
  entityType: z.literal(ENTITY.product),
  id: idSchema, // slug e.g. "black-velvet"
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  productTypeId: z.string().max(64).optional(),
  productTypeName: z.string().max(64).optional(),
  category: z.string().min(1).max(64).default("Perfume"),
  status: productStatusSchema.default("ACTIVE"),
  notesEnabled: z.boolean().default(true),
  sizes: z.array(z.union([bottleSizeSchema, z.number(), z.string()])).min(1).optional().default([30, 50, 100]),
  imageKey: z.string().max(512).optional(),
  imageAlt: z.string().max(256).optional(),
  mainImageKey: z.string().max(512).optional(),
  mainImageAlt: z.string().max(256).optional(),
  galleryImageKeys: z.array(z.string().max(512)).max(8).default([]),
  keywords: z.array(z.string().min(1).max(64)).max(30).default([]),
  notes: fragranceNotesSchema.default({ top: [], heart: [], base: [] }),
  concentration: z.string().max(64).optional(),
  gender: z.string().max(32).optional(),
  featured: z.boolean().default(false),
  bestseller: z.boolean().default(false),
  // GSI keys for scan-free queries
  GSI1PK: z.literal("PRODUCTS"),
  GSI1SK: z.string().min(1).max(256),
  GSI2PK: z.string().min(1).max(256).optional(),
  GSI2SK: z.string().min(1).max(256).optional(),
});
export type ProductItem = z.infer<typeof productItemSchema>;

/** Input schema for creating / updating variants in API */
export const variantInputSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  capacity: z.number().positive().max(10000).optional(),
  unit: productTypeUnitSchema.default("ml"),
  label: z.string().max(64).optional(),
  sizeMl: z.number().optional(), // Legacy input compatibility
  priceInr: z.number().int().min(1).max(10000000).optional(),
  mrpInr: z.number().int().min(1).max(10000000).optional(),
  stockQuantity: z.number().int().min(0).max(1000000).default(0),
  sku: z.string().min(1).max(64).optional(),
  status: variantStatusSchema.default("ACTIVE"),
  sortOrder: z.number().int().optional().default(0),
});
export type VariantInput = z.input<typeof variantInputSchema>;

/** Input schema for creating a product via Admin API */
export const productCreateInputSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  productTypeId: z.string().max(64).optional(),
  productTypeName: z.string().max(64).optional(),
  category: z.string().min(1).max(64).default("Perfume"),
  status: productStatusSchema.default("ACTIVE"),
  notesEnabled: z.boolean().optional().default(true),
  sizes: z.array(z.union([bottleSizeSchema, z.number(), z.string()])).min(1).optional().default([30, 50, 100]),
  imageKey: z.string().max(512).optional(),
  imageAlt: z.string().max(256).optional(),
  mainImageKey: z.string().max(512).optional(),
  mainImageAlt: z.string().max(256).optional(),
  galleryImageKeys: z.array(z.string().max(512)).max(8).optional().default([]),
  keywords: z.array(z.string().min(1).max(64)).max(30).optional().default([]),
  notes: fragranceNotesSchema.optional().default({ top: [], heart: [], base: [] }),
  concentration: z.string().max(64).optional(),
  gender: z.string().max(32).optional(),
  featured: z.boolean().default(false),
  bestseller: z.boolean().default(false),
  variants: z.array(variantInputSchema).max(20).optional(),
});
export type ProductCreateInput = z.input<typeof productCreateInputSchema>;

/** Input schema for updating a product via Admin API (with version check) */
export const productUpdateInputSchema = z.object({
  version: z.number().int().min(1),
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional().nullable(),
  productTypeId: z.string().max(64).optional().nullable(),
  productTypeName: z.string().max(64).optional().nullable(),
  category: z.string().min(1).max(64).optional(),
  status: productStatusSchema.optional(),
  notesEnabled: z.boolean().optional(),
  sizes: z.array(z.union([bottleSizeSchema, z.number(), z.string()])).min(1).optional(),
  imageKey: z.string().max(512).optional().nullable(),
  imageAlt: z.string().max(256).optional().nullable(),
  mainImageKey: z.string().max(512).optional().nullable(),
  mainImageAlt: z.string().max(256).optional().nullable(),
  galleryImageKeys: z.array(z.string().max(512)).max(8).optional(),
  keywords: z.array(z.string().min(1).max(64)).max(30).optional(),
  notes: fragranceNotesSchema.optional(),
  concentration: z.string().max(64).optional().nullable(),
  gender: z.string().max(32).optional().nullable(),
  featured: z.boolean().optional(),
  bestseller: z.boolean().optional(),
  variants: z.array(variantInputSchema).max(20).optional(),
});
export type ProductUpdateInput = z.input<typeof productUpdateInputSchema>;
