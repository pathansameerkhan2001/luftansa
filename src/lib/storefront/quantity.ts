/**
 * Purchase quantity rules (pure). Existing cart rule: 1–10 per line.
 * A configured stock level lowers the maximum; unset stock does not.
 */
import type { ProductOption } from "@/data/products";

export const MAX_QTY = 10;

/** Highest quantity allowed for an option; 0 means the option is out of stock. */
export function maxQuantityFor(option: Pick<ProductOption, "stockQuantity"> | undefined): number {
  if (!option) return 1;
  if (option.stockQuantity === undefined) return MAX_QTY;
  return Math.max(0, Math.min(MAX_QTY, option.stockQuantity));
}

/** Clamps a requested quantity into the valid range for an option (always at least 1). */
export function clampQuantity(quantity: number, option: Pick<ProductOption, "stockQuantity"> | undefined): number {
  const max = maxQuantityFor(option);
  if (max === 0) return 1;
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(max, Math.max(1, Math.round(quantity)));
}
