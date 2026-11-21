import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import { after } from "next/server";
import { getDataServices } from "@/lib/db/client";
import { resolvePublished, type PublishedResult } from "./published";
import { cmsCacheTags, revalidateAfterCmsWrite } from "./revalidation";
import type { CmsModuleDefinition } from "./schemas";
import { listEntries } from "./service";

/** Short refresh so scheduled start/end times take effect without a publish. */
export const CMS_REVALIDATE_SECONDS = 300;

/**
 * Published content for the storefront, cached per module and refreshed
 * immediately on publish (cache tags) without a deployment. Falls back to
 * today's approved content when the database is unavailable or the module has
 * never been configured (see ./published.ts).
 */
export async function loadPublished<T>(def: CmsModuleDefinition, fallback: readonly T[]): Promise<PublishedResult<T>> {
  const read = unstable_cache(
    async () => {
      const data = getDataServices();
      if (!data) return null;
      // Errors propagate (and are not cached); handled below.
      return listEntries(data.repo, def);
    },
    ["cms-entries", def.id],
    { tags: cmsCacheTags(def.id), revalidate: CMS_REVALIDATE_SECONDS },
  );
  let entries = null;
  try {
    entries = await read();
  } catch (e) {
    console.error(`[cms] ${def.id}: read failed, serving fallback content:`, (e as Error).name);
  }
  return resolvePublished<T>(entries, fallback, new Date());
}

/**
 * Called by admin routes after a successful CMS write. Never throws.
 * Revalidates now and once more after in-flight page regenerations have
 * finished (see ./revalidation.ts for why).
 */
export function revalidateCmsModule(moduleId: string): void {
  revalidateAfterCmsWrite(moduleId, { revalidateTag, after });
}
