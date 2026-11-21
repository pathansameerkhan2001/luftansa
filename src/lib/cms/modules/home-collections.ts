/**
 * Homepage Collections CMS module: the Personality Collection (Perfumes) and
 * Roll-On Collection panels, a single record on the existing CMS.
 *
 *   - Never published  → the default settings below (today's homepage behaviour:
 *                        automatic product selection, today's headings).
 *   - Published        → the CMS settings.
 *   - Deactivated      → both panels are removed from the homepage.
 *
 * Product facts (name, sizes, prices, images, notes, concentration, gender and
 * the Best Seller / New Launch / Buy 1 Get 1 Free flags) always come from the
 * product records managed in Admin → Products. This module only stores which
 * products each panel shows, in which order, and how the panels look.
 */
import { z } from "zod";
import { idSchema } from "@/lib/db/schemas";
import type { CmsModuleDefinition } from "../schemas";
import { isSafeHref } from "../fields";

export const COLLECTION_KEYS = ["personality", "rollOn"] as const;
export type CollectionKey = (typeof COLLECTION_KEYS)[number];
/** Product format each panel accepts (src/lib/catalogue/product-format.ts). */
export const COLLECTION_FORMAT: Record<CollectionKey, "perfume" | "roll-on"> = { personality: "perfume", rollOn: "roll-on" };

export const COLLECTION_BACKGROUNDS = ["ivory", "cream", "white"] as const;
export type CollectionBackground = (typeof COLLECTION_BACKGROUNDS)[number];
export const IMAGE_RATIOS = ["4:5", "3:4", "2:3"] as const;
export type ImageRatio = (typeof IMAGE_RATIOS)[number];
export const BADGE_POSITIONS = ["top-left", "top-right"] as const;
export type BadgePosition = (typeof BADGE_POSITIONS)[number];
export const MAX_COLLECTION_PRODUCTS = 24;

const text = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `Enter the ${label.toLowerCase()}`).max(max, `${label} must be ${max} characters or fewer`);
const optionalText = (max: number, label: string) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max, `${label} must be ${max} characters or fewer`).optional());

export const collectionSettingsSchema = z
  .object({
    enabled: z.boolean(),
    showWordmark: z.boolean().default(true),
    heading: text(1, 60, "Heading"),
    subtitle: optionalText(160, "Subtitle"),
    viewAll: z
      .object({
        show: z.boolean(),
        label: text(1, 30, "View All label"),
        href: z.string().trim().min(1, "Enter a destination").max(300).refine(isSafeHref, "Use a site path such as /perfumes, or a full https:// address"),
      })
      .strict(),
    background: z.enum(COLLECTION_BACKGROUNDS).default("ivory"),
    /**
     * automatic: today's rule (Perfumes: "personality" members first, then every
     * other active Perfume; Roll-On: every active Roll-On), in display order.
     * manual: exactly the chosen products, in the chosen order.
     */
    selection: z
      .object({
        mode: z.enum(["automatic", "manual"]),
        productIds: z
          .array(idSchema)
          .max(MAX_COLLECTION_PRODUCTS, `Choose at most ${MAX_COLLECTION_PRODUCTS} products`)
          .refine((ids) => new Set(ids).size === ids.length, "A product can only be listed once")
          .default([]),
      })
      .strict()
      .refine((s) => s.mode === "automatic" || s.productIds.length > 0, { message: "Choose at least one product, or use automatic selection", path: ["productIds"] }),
    maxProducts: z.number().int().min(1).max(MAX_COLLECTION_PRODUCTS).default(12),
    /** Which size each card shows (name, price and discount). */
    cardSize: z.enum(["largest", "smallest"]).default("largest"),
    /** Optional format pill on every card, e.g. "Roll-On Parfum". */
    formatLabel: optionalText(30, "Format label"),
    showNotes: z.boolean().default(true),
    showAttributes: z.boolean().default(true),
    showBadges: z.boolean().default(true),
  })
  .strict();
export type CollectionSettings = z.infer<typeof collectionSettingsSchema>;

export const homeCollectionsPayloadSchema = z
  .object({
    personality: collectionSettingsSchema,
    rollOn: collectionSettingsSchema,
    /** Desktop: left/right. Phones: top/bottom. */
    order: z.enum(["personality-first", "roll-on-first"]).default("personality-first"),
    design: z
      .object({
        decorative: z.boolean().default(true),
        imageRatio: z.enum(IMAGE_RATIOS).default("4:5"),
        badgePosition: z.enum(BADGE_POSITIONS).default("top-left"),
      })
      .strict()
      .default({ decorative: true, imageRatio: "4:5", badgePosition: "top-left" }),
  })
  .strict();
export type HomeCollectionsPayload = z.infer<typeof homeCollectionsPayloadSchema>;

export const HOME_COLLECTIONS_MODULE = {
  id: "home-collections",
  label: "Homepage Collections",
  kind: "singleton",
  payload: homeCollectionsPayloadSchema as unknown as z.ZodType<Record<string, unknown>>,
} as const satisfies CmsModuleDefinition;

/** Today's homepage: shown until the admin publishes their own settings. */
export const HOME_COLLECTIONS_DEFAULT: HomeCollectionsPayload = {
  personality: {
    enabled: true,
    showWordmark: true,
    heading: "Personality Collection",
    subtitle: "Distinctive fragrances that reflect your unique style.",
    viewAll: { show: true, label: "View All", href: "/perfumes" },
    background: "ivory",
    selection: { mode: "automatic", productIds: [] },
    maxProducts: 12,
    cardSize: "largest",
    showNotes: true,
    showAttributes: true,
    showBadges: true,
  },
  rollOn: {
    enabled: true,
    showWordmark: true,
    heading: "Roll On Collection",
    subtitle: "Discover your favourite fragrances in a convenient roll-on format.",
    viewAll: { show: true, label: "View All", href: "/roll-on" },
    background: "ivory",
    selection: { mode: "automatic", productIds: [] },
    maxProducts: 12,
    cardSize: "largest",
    formatLabel: "Roll-On Parfum",
    showNotes: true,
    showAttributes: true,
    showBadges: true,
  },
  order: "personality-first",
  design: { decorative: true, imageRatio: "4:5", badgePosition: "top-left" },
};

/* ------------------------------------------------------------- products --- */

/** The product facts a collection card needs (a subset of the storefront product). */
export interface CollectionProductSource {
  slug: string;
  name: string;
  displayName: string;
  format: "perfume" | "roll-on" | "other";
  options: readonly { label: string; priceInr: number; mrpInr?: number }[];
  mainImage?: { src: string; alt: string; objectPosition?: string };
  notes: { top: readonly { name: string }[]; heart: readonly { name: string }[]; base: readonly { name: string }[] };
  hasNotes: boolean;
  concentration?: string;
  gender?: string;
  bestseller: boolean;
  newLaunch: boolean;
  buyOneGetOne: boolean;
  collections: readonly string[];
  displayOrder?: number;
}

export const BADGES = ["best-seller", "new-launch", "buy-one-get-one"] as const;
export type Badge = (typeof BADGES)[number];
export const BADGE_LABEL: Record<Badge, string> = { "best-seller": "Best Seller", "new-launch": "New Launch", "buy-one-get-one": "Buy 1 Get 1 Free" };

export interface CardPrice {
  selling: number;
  /** Original price, only when above the selling price. */
  original?: number;
  /** Whole percent, rounded down (never overstates the saving). */
  discountPercent?: number;
}

export interface CollectionCardView {
  slug: string;
  /** e.g. "Daily Rizz – 100 ml" (size added when the product comes in several sizes). */
  title: string;
  href: string;
  image?: { src: string; alt: string; objectPosition?: string };
  placeholder: "spray" | "roll-on";
  badges: Badge[];
  notes: string[];
  price?: CardPrice;
  attributes: string[];
}

export interface CollectionPanelView {
  key: CollectionKey;
  /** Anchor kept from the existing homepage (header links use it). */
  anchor: "personality-collection" | "roll-on-collection";
  heading: string;
  subtitle?: string;
  showWordmark: boolean;
  viewAll?: { label: string; href: string };
  background: CollectionBackground;
  placeholder: "spray" | "roll-on";
  cards: CollectionCardView[];
}

export interface HomeCollectionsView {
  panels: CollectionPanelView[];
  decorative: boolean;
  imageRatio: ImageRatio;
  badgePosition: BadgePosition;
}

/** Discount from the original (MRP) and selling price; nothing when there is no genuine saving. */
export function cardPrice(option: { priceInr: number; mrpInr?: number }): CardPrice {
  const { priceInr, mrpInr } = option;
  if (mrpInr === undefined || !(mrpInr > priceInr)) return { selling: priceInr };
  const percent = Math.floor(((mrpInr - priceInr) / mrpInr) * 100);
  return { selling: priceInr, original: mrpInr, ...(percent >= 1 ? { discountPercent: percent } : {}) };
}

/** The size a card shows: the largest (highest-priced) or smallest; the first one on a tie. */
export function cardOption<O extends { priceInr: number }>(options: readonly O[], size: "largest" | "smallest"): O | undefined {
  let pick: O | undefined;
  for (const o of options) {
    if (!pick || (size === "largest" ? o.priceInr > pick.priceInr : o.priceInr < pick.priceInr)) pick = o;
  }
  return pick;
}

/** Up to three notes: the first top, heart and base note, then further notes in order. */
export function cardNotes(notes: CollectionProductSource["notes"], max = 3): string[] {
  const groups = [notes.top, notes.heart, notes.base].map((g) => g.map((n) => n.name.trim()).filter(Boolean));
  const ordered = [...groups.map((g) => g[0]), ...groups.flatMap((g) => g.slice(1))].filter((n): n is string => Boolean(n));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of ordered) {
    const k = n.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(n);
    if (out.length === max) break;
  }
  return out;
}

/** "25%" → "25% Oil Concentration"; any other wording is shown as entered. */
export function concentrationLabel(value: string | undefined): string | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  return /^\d{1,3}(\.\d+)?\s*%$/.test(v) ? `${v.replace(/\s+/g, "")} Oil Concentration` : v;
}

export function productBadges(p: Pick<CollectionProductSource, "bestseller" | "newLaunch" | "buyOneGetOne">): Badge[] {
  return [p.bestseller && "best-seller", p.newLaunch && "new-launch", p.buyOneGetOne && "buy-one-get-one"].filter((b): b is Badge => Boolean(b));
}

/** The product facts that decide selection (the admin editor passes only these). */
export type SelectableProduct = Pick<CollectionProductSource, "slug" | "name" | "format" | "collections" | "displayOrder">;

const byDisplayOrder = (a: SelectableProduct, b: SelectableProduct) => {
  const ao = a.displayOrder ?? Number.POSITIVE_INFINITY;
  const bo = b.displayOrder ?? Number.POSITIVE_INFINITY;
  return ao !== bo ? (ao < bo ? -1 : 1) : a.name.localeCompare(b.name);
};

/**
 * Products a panel shows (pure). Only active products are passed in, and only
 * products of the panel's format are ever used, so a hidden product, a deleted
 * product or a product of the other format can never appear.
 */
export function selectCollectionProducts<P extends SelectableProduct>(key: CollectionKey, s: CollectionSettings, products: readonly P[]): P[] {
  const format = COLLECTION_FORMAT[key];
  const eligible = products.filter((p) => p.format === format);
  let chosen: P[];
  if (s.selection.mode === "manual") {
    const bySlug = new Map(eligible.map((p) => [p.slug, p]));
    chosen = [...new Set(s.selection.productIds)].map((id) => bySlug.get(id)).filter((p): p is P => Boolean(p));
  } else {
    const sorted = [...eligible].sort(byDisplayOrder);
    chosen = key === "personality" ? [...sorted.filter((p) => p.collections.includes("personality")), ...sorted.filter((p) => !p.collections.includes("personality"))] : sorted;
  }
  return chosen.slice(0, s.maxProducts);
}

export function toCollectionCard(p: CollectionProductSource, s: CollectionSettings, href: (slug: string) => string): CollectionCardView {
  const option = cardOption(p.options, s.cardSize);
  const title = option && p.options.length > 1 ? `${p.displayName} – ${option.label}` : p.displayName;
  const attributes = s.showAttributes ? [concentrationLabel(p.concentration), s.formatLabel, p.gender?.trim()].filter((a): a is string => Boolean(a)) : [];
  return {
    slug: p.slug,
    title,
    href: href(p.slug),
    image: p.mainImage,
    placeholder: p.format === "roll-on" ? "roll-on" : "spray",
    badges: s.showBadges ? productBadges(p) : [],
    notes: s.showNotes && p.hasNotes ? cardNotes(p.notes) : [],
    price: option ? cardPrice(option) : undefined,
    attributes: [...new Set(attributes)],
  };
}

const ANCHOR: Record<CollectionKey, CollectionPanelView["anchor"]> = { personality: "personality-collection", rollOn: "roll-on-collection" };

/** What the homepage shows for a payload (pure). Disabled or empty panels are left out (no gaps). */
export function toHomeCollectionsView(p: HomeCollectionsPayload, products: readonly CollectionProductSource[], href: (slug: string) => string): HomeCollectionsView {
  const keys: CollectionKey[] = p.order === "roll-on-first" ? ["rollOn", "personality"] : ["personality", "rollOn"];
  const panels: CollectionPanelView[] = [];
  for (const key of keys) {
    const s = p[key];
    if (!s.enabled) continue;
    const cards = selectCollectionProducts(key, s, products).map((prod) => toCollectionCard(prod, s, href));
    if (cards.length === 0) continue;
    panels.push({
      key,
      anchor: ANCHOR[key],
      heading: s.heading,
      subtitle: s.subtitle,
      showWordmark: s.showWordmark,
      viewAll: s.viewAll.show ? { label: s.viewAll.label, href: s.viewAll.href } : undefined,
      background: s.background,
      placeholder: COLLECTION_FORMAT[key] === "roll-on" ? "roll-on" : "spray",
      cards,
    });
  }
  return { panels, decorative: p.design.decorative, imageRatio: p.design.imageRatio, badgePosition: p.design.badgePosition };
}

/**
 * The settings the homepage uses (pure). null = section removed (deactivated).
 * The defaults are used until something is published, while the database is
 * unavailable, and if stored settings are no longer valid (the site stays whole).
 */
export function resolveHomeCollections(result: { source: "cms" | "fallback"; items: readonly { payload: unknown }[] }): HomeCollectionsPayload | null {
  if (result.source === "cms" && result.items.length === 0) return null;
  const parsed = homeCollectionsPayloadSchema.safeParse(result.items[0]?.payload);
  return parsed.success ? parsed.data : HOME_COLLECTIONS_DEFAULT;
}
