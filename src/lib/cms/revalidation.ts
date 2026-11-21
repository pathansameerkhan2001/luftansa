/**
 * Storefront revalidation after a CMS write (pure scheduling logic; Next.js
 * functions are injected by ./loader.ts so this is unit-testable).
 *
 * Why two revalidations (Checkpoint B investigation):
 * Next.js stores a regenerated page with the time it FINISHED rendering and
 * treats it as fresh when that is later than the last revalidation of its
 * tags. A regeneration that read the CMS content just before a write, but
 * finished just after the write's revalidation, is therefore stored with the
 * previous content and served until the 5-minute time-based refresh (for
 * example a deactivated announcement bar staying visible).
 *
 * So every write revalidates immediately (normal case) and once more after
 * CMS_FOLLOW_UP_REVALIDATE_MS, when any regeneration that started before the
 * write has finished. The follow-up uses a second tag carried by the same
 * content (cmsFollowUpTag): Next.js ignores a repeat revalidation of a tag
 * already revalidated in the same request, including work run with `after`.
 */
import { cmsFollowUpTag, cmsTag } from "./registry";

/**
 * Must exceed the time a page regeneration spends between reading CMS content
 * and being stored (measured locally: about 0.1-0.3 s). Slower renders are
 * still corrected by the 5-minute time-based refresh.
 */
export const CMS_FOLLOW_UP_REVALIDATE_MS = 10_000;

/** Tags attached to cached CMS content (both revalidate the same content). */
export const cmsCacheTags = (moduleId: string): string[] => [cmsTag(moduleId), cmsFollowUpTag(moduleId)];

export interface RevalidationDeps {
  revalidateTag: (tag: string) => void;
  /** Runs work after the response is sent (Next.js `after`). */
  after: (task: () => Promise<void>) => void;
  sleep?: (ms: number) => Promise<void>;
  logError?: (message: string) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Never throws: a failed revalidation must not fail the admin's save. */
export function revalidateAfterCmsWrite(moduleId: string, deps: RevalidationDeps, followUpMs = CMS_FOLLOW_UP_REVALIDATE_MS): void {
  const log = deps.logError ?? ((m: string) => console.error(m));
  const revalidate = (tag: string) => {
    try {
      deps.revalidateTag(tag);
    } catch (e) {
      log(`[cms] revalidation of ${tag} failed: ${(e as Error).message}`);
    }
  };
  revalidate(cmsTag(moduleId));
  try {
    deps.after(async () => {
      await (deps.sleep ?? defaultSleep)(followUpMs);
      revalidate(cmsFollowUpTag(moduleId));
    });
  } catch (e) {
    // Outside a request: the immediate revalidation still applies.
    log(`[cms] follow-up revalidation not scheduled for ${moduleId}: ${(e as Error).message}`);
  }
}
