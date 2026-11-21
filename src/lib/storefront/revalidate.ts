import "server-only";

import { revalidatePath } from "next/cache";

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
    if (productId) revalidatePath(`/products/${productId}`);
    // Covers every other product page (e.g. collection membership changes).
    revalidatePath("/products/[slug]", "page");
  } catch (e) {
    console.error("[storefront] Revalidation failed:", (e as Error).message);
  }
}
