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

/* -------------------------------------------------------------------------- */
/* Phase 2: Product & Variant Schemas                                         */
/* -------------------------------------------------------------------------- */

export const PRODUCT_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export const productStatusSchema = z.enum(PRODUCT_STATUSES);
export type ProductStatus = z.infer<typeof productStatusSchema>;

export const BOTTLE_SIZES_ML = [30, 50, 100] as const;
export const bottleSizeSchema = z.union([z.literal(30), z.literal(50), z.literal(100)]);
export type BottleSizeMl = z.infer<typeof bottleSizeSchema>;

/** Confirmed standard pricing (INR) by bottle size */
export const STANDARD_PRICES_INR: Record<BottleSizeMl, number> = {
  30: 400,
  50: 630,
  100: 1000,
};

/** Product variant stored item (sk: VARIANT#00030) */
export const productVariantItemSchema = baseItemSchema.extend({
  entityType: z.literal(ENTITY.variant),
  productId: idSchema,
  sizeMl: bottleSizeSchema,
  priceInr: z.number().int().min(1),
  mrpInr: z.number().int().min(1).optional(),
  stockQuantity: z.number().int().min(0).default(0),
  sku: z.string().min(1).max(64),
  status: productStatusSchema.default("ACTIVE"),
});
export type ProductVariantItem = z.infer<typeof productVariantItemSchema>;

/** Product metadata stored item (sk: META) */
export const productItemSchema = baseItemSchema.extend({
  entityType: z.literal(ENTITY.product),
  id: idSchema, // slug e.g. "black-velvet"
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  category: z.string().min(1).max(64).default("Perfume"),
  status: productStatusSchema.default("ACTIVE"),
  sizes: z.array(bottleSizeSchema).min(1),
  imageKey: z.string().max(256).optional(),
  imageAlt: z.string().max(256).optional(),
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
  sizeMl: bottleSizeSchema,
  priceInr: z.number().int().min(1).optional(),
  mrpInr: z.number().int().min(1).optional(),
  stockQuantity: z.number().int().min(0).default(0),
  sku: z.string().min(1).max(64).optional(),
  status: productStatusSchema.default("ACTIVE"),
});
export type VariantInput = z.input<typeof variantInputSchema>;

/** Input schema for creating a product via Admin API */
export const productCreateInputSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  category: z.string().min(1).max(64).default("Perfume"),
  status: productStatusSchema.default("ACTIVE"),
  sizes: z.array(bottleSizeSchema).min(1).default([30, 50, 100]),
  imageKey: z.string().max(256).optional(),
  imageAlt: z.string().max(256).optional(),
  concentration: z.string().max(64).optional(),
  gender: z.string().max(32).optional(),
  featured: z.boolean().default(false),
  bestseller: z.boolean().default(false),
  variants: z.array(variantInputSchema).optional(),
});
export type ProductCreateInput = z.input<typeof productCreateInputSchema>;

/** Input schema for updating a product via Admin API (with version check) */
export const productUpdateInputSchema = z.object({
  version: z.number().int().min(1),
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().min(1).max(64).optional(),
  status: productStatusSchema.optional(),
  sizes: z.array(bottleSizeSchema).min(1).optional(),
  imageKey: z.string().max(256).optional().nullable(),
  imageAlt: z.string().max(256).optional().nullable(),
  concentration: z.string().max(64).optional().nullable(),
  gender: z.string().max(32).optional().nullable(),
  featured: z.boolean().optional(),
  bestseller: z.boolean().optional(),
  variants: z.array(variantInputSchema).optional(),
});
export type ProductUpdateInput = z.input<typeof productUpdateInputSchema>;
