/**
 * Product trust tags CMS module: the global quality tags shown in the DETAILS
 * section of every product page (Perfumes and Roll-Ons alike), a single record
 * on the existing CMS. They never depend on product data, so every existing,
 * new or imported product shows them.
 *
 *   - Never published  → the five default tags, all enabled.
 *   - Published        → the CMS labels, order and on/off switches.
 *   - Deactivated      → no trust tags on product pages.
 *
 * The set of tags (and so their icons) is fixed; only the label, order and
 * visibility are editable (no free-form icons or markup).
 */
import { z } from "zod";
import type { CmsModuleDefinition } from "../schemas";

export const TRUST_TAG_IDS = ["lab-tested", "people-surveyed", "made-in-india", "vegan", "ifra"] as const;
export type TrustTagId = (typeof TRUST_TAG_IDS)[number];

/** What each tag is, for the admin (the label shown on the site is editable). */
export const TRUST_TAG_PURPOSE: Record<TrustTagId, string> = {
  "lab-tested": "Longevity testing (flask icon)",
  "people-surveyed": "Customer survey (people icon)",
  "made-in-india": "Made in India (Ashoka Chakra icon)",
  vegan: "Vegan & cruelty-free (rabbit icon)",
  ifra: "IFRA safety (shield icon)",
};

export const trustTagSchema = z
  .object({
    id: z.enum(TRUST_TAG_IDS),
    label: z.string().trim().min(1, "Enter the label").max(40, "Label must be 40 characters or fewer"),
    enabled: z.boolean(),
  })
  .strict();
export type TrustTag = z.infer<typeof trustTagSchema>;

export const trustTagsPayloadSchema = z
  .object({
    /** Display order = array order. Every tag appears exactly once. */
    tags: z
      .array(trustTagSchema)
      .length(TRUST_TAG_IDS.length, "Every trust tag must be listed")
      .refine((tags) => new Set(tags.map((t) => t.id)).size === tags.length, "Each trust tag can only be listed once"),
  })
  .strict();
export type TrustTagsPayload = z.infer<typeof trustTagsPayloadSchema>;

export const TRUST_TAGS_MODULE = {
  id: "trust-tags",
  label: "Product Trust Tags",
  kind: "singleton",
  payload: trustTagsPayloadSchema as unknown as z.ZodType<Record<string, unknown>>,
} as const satisfies CmsModuleDefinition;

export const TRUST_TAGS_DEFAULT: TrustTagsPayload = {
  tags: [
    { id: "lab-tested", label: "Lab Tested Longevity", enabled: true },
    { id: "people-surveyed", label: "1200+ People Surveyed", enabled: true },
    { id: "made-in-india", label: "Made in India", enabled: true },
    { id: "vegan", label: "100% Vegan & Cruelty-free", enabled: true },
    { id: "ifra", label: "IFRA Safe Formula", enabled: true },
  ],
};

export interface TrustTagView {
  id: TrustTagId;
  label: string;
}

/** Enabled tags, in order (pure). */
export function toTrustTagsView(p: TrustTagsPayload): TrustTagView[] {
  return p.tags.filter((t) => t.enabled).map(({ id, label }) => ({ id, label }));
}

/**
 * Tags product pages show (pure). Deactivated → none. The defaults are used
 * until something is published, while the database is unavailable, and if the
 * stored settings are no longer valid.
 */
export function resolveTrustTags(result: { source: "cms" | "fallback"; items: readonly { payload: unknown }[] }): TrustTagView[] {
  if (result.source === "cms" && result.items.length === 0) return [];
  const parsed = trustTagsPayloadSchema.safeParse(result.items[0]?.payload);
  return toTrustTagsView(parsed.success ? parsed.data : TRUST_TAGS_DEFAULT);
}
