import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

/** Cache tag of small catalogue facts shown site-wide (e.g. whether the footer lists Attar). */
export const CATALOGUE_TAG = "storefront:catalogue";

/**
 * Storefront pages are statically cached (ISR). After any admin catalogue
 * write, purge the pages that render catalogue data so the change is visible
 * on the next request instead of after the next deployment.
 *
 * Never throws: a failed purge must not fail the admin write that already
 * succeeded (pages still refresh via their time-based `revalidate`).
 */
export function revalidateStorefront(productId?: string): void {
  try {
    revalidatePath("/");
    // Section listings (Perfumes, Roll-On).
    revalidatePath("/perfumes");
    revalidatePath("/roll-on");
    // Collection pages built from product data.
    revalidatePath("/best-sellers");
    revalidatePath("/collections/personality");
    // Header collections (Admin → Collections Menu).
    revalidatePath("/collections/[slug]", "page");
    revalidatePath("/attar");
    revalidatePath("/notes/[family]", "page");
    revalidatePath("/search");
    revalidateTag(CATALOGUE_TAG);
    if (productId) revalidatePath(`/products/${productId}`);
    // Covers every other product page (e.g. collection membership changes).
    revalidatePath("/products/[slug]", "page");
  } catch (e) {
    console.error("[storefront] Revalidation failed:", (e as Error).message);
  }
}
