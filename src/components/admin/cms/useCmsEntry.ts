"use client";

/**
 * Admin client for one CMS entry (Phase 3B), on the existing generic API:
 *   GET    /api/admin/cms/:module            list
 *   POST   /api/admin/cms/:module            create (draft)
 *   PATCH  /api/admin/cms/:module/:id        saveDraft | settings | publish | unpublish
 *
 * Every write sends the version it was based on; if someone else changed the
 * entry meanwhile, the server answers 409 and the message tells the editor to
 * reload (nothing is silently overwritten).
 */
import { useCallback, useEffect, useState } from "react";
import type { ContentEntry, Visibility } from "@/lib/cms/schemas";
import { adminFetch } from "./ui";

export type CmsEntry = Pick<
  ContentEntry,
  "id" | "module" | "status" | "displayOrder" | "visibility" | "draft" | "published" | "hasUnpublishedChanges" | "version" | "updatedAt" | "updatedBy" | "publishedAt" | "publishedBy"
>;

const base = (moduleId: string) => `/api/admin/cms/${encodeURIComponent(moduleId)}`;

export const cmsApi = {
  list: (moduleId: string) => adminFetch<{ items: CmsEntry[] }>(base(moduleId)).then((r) => r.items),
  create: (moduleId: string, draft: Record<string, unknown>) =>
    adminFetch<{ item: CmsEntry }>(base(moduleId), { method: "POST", body: JSON.stringify({ draft }) }).then((r) => r.item),
  patch: (moduleId: string, id: string, body: Record<string, unknown>) =>
    adminFetch<{ item: CmsEntry }>(`${base(moduleId)}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }).then((r) => r.item),
};

export type EntryAction = "save" | "publish" | "unpublish" | "visibility";

/**
 * A single-record module (Hero, Our Brand, …). `entry` is null until the
 * first draft is saved.
 */
export function useCmsSingleton(moduleId: string) {
  const [entry, setEntry] = useState<CmsEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<EntryAction | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const items = await cmsApi.list(moduleId);
      setEntry(items[0] ?? null);
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = useCallback(async (action: EntryAction, fn: () => Promise<CmsEntry>) => {
    setBusy(action);
    try {
      const next = await fn();
      setEntry(next);
      return next;
    } finally {
      setBusy(null);
    }
  }, []);

  /** Creates the entry on first save, then saves drafts against the current version. */
  const saveDraft = useCallback(
    (draft: Record<string, unknown>) =>
      run("save", () => (entry ? cmsApi.patch(moduleId, entry.id, { action: "saveDraft", version: entry.version, draft }) : cmsApi.create(moduleId, draft))),
    [entry, moduleId, run],
  );

  /** Saves (when `draft` is given) and then publishes, as one user action. */
  const publish = useCallback(
    (draft?: Record<string, unknown>) =>
      run("publish", async () => {
        let current = entry;
        if (draft) current = current ? await cmsApi.patch(moduleId, current.id, { action: "saveDraft", version: current.version, draft }) : await cmsApi.create(moduleId, draft);
        if (!current) throw new Error("Save the section before publishing.");
        setEntry(current);
        return cmsApi.patch(moduleId, current.id, { action: "publish", version: current.version });
      }),
    [entry, moduleId, run],
  );

  const unpublish = useCallback(() => {
    if (!entry) return Promise.reject(new Error("Nothing to deactivate."));
    return run("unpublish", () => cmsApi.patch(moduleId, entry.id, { action: "unpublish", version: entry.version }));
  }, [entry, moduleId, run]);

  const setVisibility = useCallback(
    (visibility: Visibility) => {
      if (!entry) return Promise.reject(new Error("Save the section first."));
      return run("visibility", () => cmsApi.patch(moduleId, entry.id, { action: "settings", version: entry.version, settings: { visibility } }));
    },
    [entry, moduleId, run],
  );

  return { entry, loading, loadError, busy, reload, saveDraft, publish, unpublish, setVisibility };
}

/** Warns before leaving the page (reload, close, external link) with unsaved edits. */
export function useUnsavedChangesWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
