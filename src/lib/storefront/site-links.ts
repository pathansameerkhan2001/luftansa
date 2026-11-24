import "server-only";

import { unstable_cache } from "next/cache";
import { selectAttar } from "./collection-pages";
import { getActiveStorefrontProducts } from "./products";
import { CATALOGUE_TAG } from "./revalidate";

/**
 * True while at least one Attar is active (the footer then links /attar).
 * Cached because the footer renders on every page; refreshed by product
 * writes (revalidateStorefront) and every 10 minutes.
 */
export const hasActiveAttar = unstable_cache(async () => selectAttar(await getActiveStorefrontProducts()).length > 0, ["storefront-has-attar"], {
  tags: [CATALOGUE_TAG],
  revalidate: 600,
});
