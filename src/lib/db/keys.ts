/**
 * Single-table key design for `luftansa-store` (pk/sk, both strings).
 *
 *   PRODUCT#<id>   META | VARIANT#<ml> | STOCK#<iso>#<uid>
 *   ORDER#<id>     META | ITEM#<n> | EVENT#<iso>#<uid>
 *   CUSTOMER#<id>  PROFILE | ORDER#<iso>#<orderId>
 *   CONTENT#<sec>  PUBLISHED | DRAFT | V#<n>
 *   SETTINGS       STORE | SHIPPING | SOCIAL | CONTACT
 *   PROMO#<id>     META
 *   MEDIA#<id>     META
 *   STATS          COUNTERS
 *   AUDIT#<yyyy-mm> <iso>#<uid>
 *
 * Identifiers are validated so user input can never inject "#" separators or
 * address another entity's partition.
 */

export const ENTITY = {
  product: "PRODUCT",
  variant: "VARIANT",
  stock: "STOCK",
  order: "ORDER",
  orderItem: "ORDER_ITEM",
  orderEvent: "ORDER_EVENT",
  customer: "CUSTOMER",
  content: "CONTENT",
  settings: "SETTINGS",
  promo: "PROMO",
  media: "MEDIA",
  stats: "STATS",
  audit: "AUDIT",
} as const;
export type EntityType = (typeof ENTITY)[keyof typeof ENTITY];

export interface ItemKey {
  pk: string;
  sk: string;
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export class InvalidKeyError extends Error {}

/** Validates an identifier used inside a key. */
export function assertId(value: string, label = "id"): string {
  if (!ID.test(value)) throw new InvalidKeyError(`Invalid ${label}`);
  return value;
}

const iso = (d: Date) => d.toISOString();

export const keys = {
  product: (id: string): ItemKey => ({ pk: `PRODUCT#${assertId(id)}`, sk: "META" }),
  productGsi1: (status: string, id: string) => ({ GSI1PK: "PRODUCTS" as const, GSI1SK: `STATUS#${status}#SLUG#${assertId(id)}` }),
  productGsi2: (category: string, id: string) => ({ GSI2PK: `CATEGORY#${category}`, GSI2SK: `SLUG#${assertId(id)}` }),
  variant: (productId: string, sizeMl: number): ItemKey => {
    if (!Number.isInteger(sizeMl) || sizeMl <= 0 || sizeMl > 10000) throw new InvalidKeyError("Invalid size");
    return { pk: `PRODUCT#${assertId(productId)}`, sk: `VARIANT#${String(sizeMl).padStart(5, "0")}` };
  },
  stockEntry: (productId: string, at: Date, uid: string): ItemKey => ({
    pk: `PRODUCT#${assertId(productId)}`,
    sk: `STOCK#${iso(at)}#${assertId(uid, "uid")}`,
  }),
  order: (id: string): ItemKey => ({ pk: `ORDER#${assertId(id)}`, sk: "META" }),
  customer: (id: string): ItemKey => ({ pk: `CUSTOMER#${assertId(id)}`, sk: "PROFILE" }),
  content: (section: string, state: "PUBLISHED" | "DRAFT"): ItemKey => ({ pk: `CONTENT#${assertId(section, "section")}`, sk: state }),
  settings: (name: "STORE" | "SHIPPING" | "SOCIAL" | "CONTACT"): ItemKey => ({ pk: "SETTINGS", sk: name }),
  promo: (id: string): ItemKey => ({ pk: `PROMO#${assertId(id)}`, sk: "META" }),
  media: (id: string): ItemKey => ({ pk: `MEDIA#${assertId(id)}`, sk: "META" }),
  stats: (): ItemKey => ({ pk: "STATS", sk: "COUNTERS" }),
  audit: (at: Date, uid: string): ItemKey => ({
    pk: `AUDIT#${iso(at).slice(0, 7)}`,
    sk: `${iso(at)}#${assertId(uid, "uid")}`,
  }),
  auditPartition: (at: Date): string => `AUDIT#${iso(at).slice(0, 7)}`,
} as const;

/** Prefixes for sort-key range queries within a partition. */
export const SK_PREFIX = {
  variant: "VARIANT#",
  stock: "STOCK#",
  orderItem: "ITEM#",
  orderEvent: "EVENT#",
  customerOrder: "ORDER#",
} as const;
