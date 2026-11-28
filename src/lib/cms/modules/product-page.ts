/**
 * Product Page Sections CMS module: which optional information accordions the
 * public product page shows, a single record on the existing CMS.
 *
 * Only display is controlled here. Product descriptions (Admin → Products) and
 * the store FAQs (src/data/faqs.ts, also on /faqs) are never changed or
 * deleted: a hidden section is simply not rendered on the product page.
 * Fragrance Notes, Details and How to Use & Care are always shown.
 *
 *   - Never published / deactivated / unavailable → the defaults (both hidden).
 *   - Published                                   → the CMS switches.
 */
import { z } from "zod";
import type { CmsModuleDefinition } from "../schemas";

export const productPagePayloadSchema = z
  .object({
    showDescription: z.boolean(),
    showFaq: z.boolean(),
  })
  .strict();
export type ProductPagePayload = z.infer<typeof productPagePayloadSchema>;

export const PRODUCT_PAGE_MODULE = {
  id: "product-page",
  label: "Product Page Sections",
  kind: "singleton",
  payload: productPagePayloadSchema as unknown as z.ZodType<Record<string, unknown>>,
} as const satisfies CmsModuleDefinition;

export const PRODUCT_PAGE_DEFAULT: ProductPagePayload = { showDescription: false, showFaq: false };

export function resolveProductPage(result: { source: "cms" | "fallback"; items: readonly { payload: unknown }[] }): ProductPagePayload {
  const parsed = productPagePayloadSchema.safeParse(result.items[0]?.payload);
  return parsed.success ? parsed.data : PRODUCT_PAGE_DEFAULT;
}
