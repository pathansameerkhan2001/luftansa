/**
 * Navigation Collections CMS module: the header's COLLECTIONS dropdown and the
 * collection pages it opens, a single record on the existing CMS (draft,
 * preview, publish, deactivate).
 *
 *   - Never published  → the defaults below (Roll-On Air Freshener, Car Freshener).
 *   - Published        → the CMS collections, in their order, active ones only.
 *   - Deactivated      → no COLLECTIONS item in the header; collection pages 404.
 *
 * Product membership is never stored on the products (no product schema
 * change): a collection either lists every active product of one product type
 * (Admin → Products → product type), or exactly the products chosen in
 * Admin → Collections Menu, in the chosen order.
 *
 * A collection opens /collections/<slug>, or an existing storefront page
 * (`linkTo`, e.g. the existing /roll-on listing) so nothing is duplicated.
 */
import { z } from "zod";
import { idSchema } from "@/lib/db/schemas";
import type { CmsModuleDefinition } from "../schemas";
import { mediaKeySchema } from "../fields";

export const MAX_NAV_COLLECTIONS = 12;
export const MAX_NAV_COLLECTION_PRODUCTS = 60;

/** Slugs already used by a dedicated page under /collections (src/app/collections/*). */
export const RESERVED_COLLECTION_SLUGS = ["personality"] as const;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const optionalText = (max: number, label: string) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max, `${label} must be ${max} characters or fewer`).optional());

/** An existing page on this site ("/roll-on"): never an external address. */
const internalPathSchema = z
  .string()
  .trim()
  .max(120)
  .refine((v) => /^\/[a-z0-9\-/]*$/i.test(v) && !v.startsWith("//") && !v.includes(".."), "Use a page on this site, such as /roll-on");

export const navCollectionSchema = z
  .object({
    /** Stable identifier (kept when the name or slug changes). */
    id: idSchema,
    name: z.string().trim().min(1, "Enter the collection name").max(40, "Name must be 40 characters or fewer"),
    slug: z
      .string()
      .trim()
      .min(1, "Enter the web address")
      .max(60, "Web address must be 60 characters or fewer")
      .regex(SLUG, "Use lowercase letters, numbers and single hyphens, e.g. car-freshener")
      .refine((s) => !(RESERVED_COLLECTION_SLUGS as readonly string[]).includes(s), "This web address is already used by another page"),
    description: optionalText(400, "Description"),
    imageKey: z.preprocess((v) => (v === "" || v === null ? undefined : v), mediaKeySchema("image").optional()),
    imageAlt: optionalText(200, "Image description"),
    enabled: z.boolean(),
    /** Opens this existing page instead of /collections/<slug>. */
    linkTo: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), internalPathSchema.optional()),
    selection: z
      .object({
        /** product-type: every active product of `productTypeId`. manual: exactly `productIds`, in order. */
        mode: z.enum(["product-type", "manual"]),
        productTypeId: z.preprocess((v) => (v === "" ? undefined : v), idSchema.optional()),
        productIds: z
          .array(idSchema)
          .max(MAX_NAV_COLLECTION_PRODUCTS, `Choose at most ${MAX_NAV_COLLECTION_PRODUCTS} products`)
          .refine((ids) => new Set(ids).size === ids.length, "A product can only be listed once")
          .default([]),
      })
      .strict()
      .refine((s) => s.mode !== "product-type" || Boolean(s.productTypeId), { message: "Choose a product type", path: ["productTypeId"] }),
  })
  .strict();
export type NavCollection = z.infer<typeof navCollectionSchema>;

export const navCollectionsPayloadSchema = z
  .object({
    /** Header label of the dropdown. */
    menuLabel: z.string().trim().min(1, "Enter the menu label").max(24, "Menu label must be 24 characters or fewer"),
    /** Display order = array order. */
    collections: z
      .array(navCollectionSchema)
      .max(MAX_NAV_COLLECTIONS, `At most ${MAX_NAV_COLLECTIONS} collections`)
      .superRefine((list, ctx) => {
        const seen = { id: new Set<string>(), slug: new Set<string>() };
        list.forEach((c, i) => {
          if (seen.id.has(c.id)) ctx.addIssue({ code: "custom", message: "Each collection needs its own identifier", path: [i, "id"] });
          if (seen.slug.has(c.slug)) ctx.addIssue({ code: "custom", message: "Another collection already uses this web address", path: [i, "slug"] });
          seen.id.add(c.id);
          seen.slug.add(c.slug);
        });
      }),
  })
  .strict();
export type NavCollectionsPayload = z.infer<typeof navCollectionsPayloadSchema>;

export const NAV_COLLECTIONS_MODULE = {
  id: "nav-collections",
  label: "Collections Menu",
  kind: "singleton",
  payload: navCollectionsPayloadSchema as unknown as z.ZodType<Record<string, unknown>>,
} as const satisfies CmsModuleDefinition;

/** Product type of car fresheners (created in Admin → Products when the first one is added). */
export const CAR_FRESHENER_TYPE_ID = "car-freshener";

/**
 * Shown until the admin publishes their own settings. Roll-On Air Freshener
 * reuses the existing Roll-On listing (/roll-on, product type "roll-on"), so no
 * duplicate collection exists. Car Freshener has its own page and only ever
 * lists products of the "car-freshener" type, never Roll-Ons.
 */
export const NAV_COLLECTIONS_DEFAULT: NavCollectionsPayload = {
  menuLabel: "Collections",
  collections: [
    {
      id: "roll-on-air-freshener",
      name: "Roll-On Air Freshener",
      slug: "roll-on",
      description: "Our fragrances in a convenient roll-on, for your bag, desk or travels.",
      enabled: true,
      linkTo: "/roll-on",
      selection: { mode: "product-type", productTypeId: "roll-on", productIds: [] },
    },
    {
      id: "car-freshener",
      name: "Car Freshener",
      slug: "car-freshener",
      description: "Luftansa fragrances for your car.",
      enabled: true,
      selection: { mode: "product-type", productTypeId: CAR_FRESHENER_TYPE_ID, productIds: [] },
    },
  ],
};

export const collectionPath = (slug: string) => `/collections/${slug}`;

/** Where a collection's menu link goes. */
export function collectionHref(c: Pick<NavCollection, "slug" | "linkTo">): string {
  return c.linkTo ?? collectionPath(c.slug);
}

export interface NavMenuLink {
  label: string;
  href: string;
}

export interface NavCollectionsMenu {
  label: string;
  items: NavMenuLink[];
}

/** The header dropdown (pure): active collections, in order. null = no COLLECTIONS item. */
export function toCollectionsMenu(p: NavCollectionsPayload | null): NavCollectionsMenu | null {
  if (!p) return null;
  const items = p.collections.filter((c) => c.enabled).map((c) => ({ label: c.name, href: collectionHref(c) }));
  return items.length ? { label: p.menuLabel, items } : null;
}

/**
 * The settings the storefront uses (pure). null = deactivated. The defaults
 * are used until something is published, while the database is unavailable,
 * and if stored settings are no longer valid (the site stays whole).
 */
export function resolveNavCollections(result: { source: "cms" | "fallback"; items: readonly { payload: unknown }[] }): NavCollectionsPayload | null {
  if (result.source === "cms" && result.items.length === 0) return null;
  const parsed = navCollectionsPayloadSchema.safeParse(result.items[0]?.payload);
  return parsed.success ? parsed.data : NAV_COLLECTIONS_DEFAULT;
}

/** An active collection by its web address, or undefined (404). */
export function findActiveCollection(p: NavCollectionsPayload | null, slug: string): NavCollection | undefined {
  return p?.collections.find((c) => c.enabled && c.slug === slug);
}

export interface CollectionMember {
  slug: string;
  name: string;
  productTypeId?: string;
  displayOrder?: number;
}

const byDisplayOrder = (a: CollectionMember, b: CollectionMember) => {
  const ao = a.displayOrder ?? Number.POSITIVE_INFINITY;
  const bo = b.displayOrder ?? Number.POSITIVE_INFINITY;
  return ao !== bo ? (ao < bo ? -1 : 1) : a.name.localeCompare(b.name);
};

/**
 * Products of a collection (pure). Only active products are passed in, so a
 * hidden or deleted product can never appear. Product-type collections use the
 * storefront display order; manual collections the chosen order.
 */
export function selectNavCollectionProducts<P extends CollectionMember>(c: Pick<NavCollection, "selection">, products: readonly P[]): P[] {
  const { selection } = c;
  if (selection.mode === "manual") {
    const bySlug = new Map(products.map((p) => [p.slug, p]));
    return [...new Set(selection.productIds)].map((id) => bySlug.get(id)).filter((p): p is P => Boolean(p));
  }
  return products.filter((p) => p.productTypeId === selection.productTypeId).sort(byDisplayOrder);
}
