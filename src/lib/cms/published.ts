/**
 * What the storefront shows for a CMS module (pure).
 *
 * Fallback rules (so missing CMS data can never break the live site):
 *   - database unavailable or read failed  -> fallback (today's approved content)
 *   - nothing has ever been published      -> fallback. This includes modules
 *     with draft entries only: saving a first draft must never change or blank
 *     the live site; only Publish does.
 *   - something has been published         -> only PUBLISHED entries whose
 *     schedule includes `now`, in display order. This may be an empty list
 *     when the administrator has deliberately unpublished (deactivated)
 *     everything.
 * "Published at least once" is recorded by `publishedAt`, which publishing
 * sets and unpublishing keeps.
 * Desktop/mobile visibility is applied when rendering (CSS), because cached
 * pages are shared by all devices.
 */
import type { ContentEntry, Visibility } from "./schemas";

export interface PublishedItem<T> {
  id: string;
  displayOrder: number;
  visibility: Visibility;
  payload: T;
}

export type PublishedResult<T> =
  | { source: "cms"; items: PublishedItem<T>[] }
  | { source: "fallback"; items: PublishedItem<T>[] };

export function isWithinSchedule(entry: Pick<ContentEntry, "schedule">, now: Date): boolean {
  const s = entry.schedule;
  if (!s) return true;
  const t = now.toISOString();
  if (s.startAt && t < s.startAt) return false;
  if (s.endAt && t >= s.endAt) return false;
  return true;
}

/** True once the entry has been published, even if it was later unpublished. */
export function hasBeenPublished(entry: Pick<ContentEntry, "status" | "publishedAt">): boolean {
  return entry.status === "PUBLISHED" || entry.publishedAt !== undefined;
}

export function selectPublished<T>(entries: readonly ContentEntry[], now: Date): PublishedItem<T>[] {
  return entries
    .filter((e) => e.status === "PUBLISHED" && e.published && isWithinSchedule(e, now))
    .sort((a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id))
    .map((e) => ({ id: e.id, displayOrder: e.displayOrder, visibility: e.visibility, payload: e.published as T }));
}

/** `entries` is null when the database is unavailable or the read failed. */
export function resolvePublished<T>(entries: readonly ContentEntry[] | null, fallback: readonly T[], now: Date): PublishedResult<T> {
  const fallbackItems = (): PublishedItem<T>[] =>
    fallback.map((payload, i) => ({ id: `default-${i}`, displayOrder: i, visibility: { desktop: true, mobile: true }, payload }));
  if (entries === null || !entries.some(hasBeenPublished)) return { source: "fallback", items: fallbackItems() };
  return { source: "cms", items: selectPublished<T>(entries, now) };
}
