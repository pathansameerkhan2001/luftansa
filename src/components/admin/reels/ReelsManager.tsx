"use client";

/**
 * Admin: homepage Instagram Reels (Phase 4), on the existing CMS:
 *   - section text (CMS module "reels-section"; Hide/Show the whole section),
 *   - Reels (CMS list module "reels"): add, edit, order, activate/deactivate, delete.
 * Active = published; Inactive = deactivated (kept, not shown on the website).
 * Videos and posters come from the Media Library, which keeps files that are
 * still in use from being deleted.
 */
import Image from "next/image";
import { ArrowDown, ArrowUp, Clapperboard, Eye, EyeOff, Film, Pencil, Plus, Trash2, Type } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MediaField, useMediaLibrary, type MediaLibraryState } from "@/components/admin/cms/MediaPicker";
import { Card, TextField } from "@/components/admin/cms/FormFields";
import { cmsApi, useCmsSingleton, useUnsavedChangesWarning, type CmsEntry } from "@/components/admin/cms/useCmsEntry";
import {
  adminFetch, BTN_ICON, BTN_PRIMARY, BTN_SECONDARY, ConfirmDialog, EmptyState, FeedbackBanner, FilterTabs, INPUT, PageIntro, Spinner, StatusBadge, useFeedback,
} from "@/components/admin/cms/ui";
import { formatBytes } from "@/lib/media/client-upload";
import {
  MAX_REELS, REELS_MODULE, REELS_SECTION_DEFAULT, REELS_SECTION_MODULE, reelPayloadSchema, reelsSectionPayloadSchema, type ReelPayload,
} from "@/lib/cms/modules/reels";

const MEDIA_ROUTE = "/media/";
type ProductOption = { id: string; name: string; status: string; productTypeId?: string };

/* ---------------------------------------------------------------- section --- */

function SectionSettings() {
  const cms = useCmsSingleton(REELS_SECTION_MODULE.id);
  const { feedback, setFeedback, clear } = useFeedback();
  const saved = useMemo(() => {
    const d = (cms.entry?.draft ?? REELS_SECTION_DEFAULT) as Partial<typeof REELS_SECTION_DEFAULT>;
    return { heading: d.heading ?? "", subtitle: d.subtitle ?? "", instagramProfileUrl: d.instagramProfileUrl ?? "" };
  }, [cms.entry]);
  const [edit, setEdit] = useState<{ base: typeof saved; form: typeof saved } | null>(null);
  const form = edit && edit.base === saved ? edit.form : saved;
  const set = (patch: Partial<typeof saved>) => setEdit({ base: saved, form: { ...form, ...patch } });
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  useUnsavedChangesWarning(dirty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const hidden = cms.entry?.status === "UNPUBLISHED";

  const save = async () => {
    clear();
    const parsed = reelsSectionPayloadSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    try {
      await cms.publish(parsed.data as Record<string, unknown>);
      setEdit(null);
      setFeedback({ tone: "success", message: "Section saved. The homepage shows the new text." });
    } catch (e) {
      setFeedback({ tone: "error", message: (e as Error).message });
    }
  };
  const toggle = async () => {
    clear();
    try {
      // Only offered once the section has been saved (cms.entry exists).
      if (hidden) await cms.publish();
      else await cms.unpublish();
      setFeedback({ tone: "success", message: hidden ? "The Reels section is shown on the homepage again." : "The Reels section is hidden on the homepage." });
    } catch (e) {
      setFeedback({ tone: "error", message: (e as Error).message });
    }
  };

  return (
    <Card
      icon={<Type className="size-4.5" strokeWidth={1.5} />}
      title="Section"
      description="Heading and text above the Reels on the homepage. The section only appears while at least one Reel is active."
      actions={
        cms.loading ? null : (
          <div className="flex items-center gap-2">
            <StatusBadge tone={hidden ? "dark" : "success"}>{hidden ? "Hidden" : cms.entry ? "Shown" : "Shown · default text"}</StatusBadge>
            {cms.entry ? (
              <button type="button" onClick={() => void toggle()} disabled={cms.busy !== null} className={BTN_SECONDARY} data-action="toggle-section">
                {hidden ? <Eye aria-hidden="true" className="size-4" /> : <EyeOff aria-hidden="true" className="size-4" />}
                {hidden ? "Show section" : "Hide section"}
              </button>
            ) : null}
          </div>
        )
      }
    >
      <FeedbackBanner feedback={feedback} onDismiss={clear} />
      {cms.loading ? (
        <Spinner label="Loading…" />
      ) : cms.loadError ? (
        <FeedbackBanner feedback={{ tone: "error", message: cms.loadError }} onDismiss={() => void cms.reload()} />
      ) : (
        <div className="space-y-4">
          <TextField id="reels-heading" label="Heading" required value={form.heading} max={80} error={errors.heading} onChange={(heading) => set({ heading })} />
          <TextField id="reels-subtitle" label="Supporting text" value={form.subtitle} max={240} multiline error={errors.subtitle} onChange={(subtitle) => set({ subtitle })} />
          <TextField
            id="reels-profile"
            label="Instagram profile link"
            value={form.instagramProfileUrl}
            max={200}
            error={errors.instagramProfileUrl}
            help="Optional. Shows an “Explore More on Instagram” button, e.g. https://www.instagram.com/luftansa/"
            onChange={(instagramProfileUrl) => set({ instagramProfileUrl })}
          />
          <div className="flex justify-end">
            <button type="button" onClick={() => void save()} disabled={cms.busy !== null || (!dirty && Boolean(cms.entry))} className={BTN_PRIMARY} data-action="save-section">
              {cms.busy === "publish" ? <Spinner label="Saving…" /> : "Save section"}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------- form --- */

interface ReelForm {
  title: string;
  caption: string;
  fragranceName: string;
  videoSource: "upload" | "url";
  videoKey: string;
  videoUrl: string;
  posterKey: string;
  posterAlt: string;
  instagramUrl: string;
  productId: string;
  active: boolean;
}

const EMPTY_FORM: ReelForm = { title: "", caption: "", fragranceName: "", videoSource: "upload", videoKey: "", videoUrl: "", posterKey: "", posterAlt: "", instagramUrl: "", productId: "", active: true };

function toForm(entry: CmsEntry): ReelForm {
  const d = entry.draft as Partial<ReelPayload> & { video?: { source?: string; key?: string; url?: string } };
  return {
    title: d.title ?? "",
    caption: d.caption ?? "",
    fragranceName: d.fragranceName ?? "",
    videoSource: d.video?.source === "url" ? "url" : "upload",
    videoKey: d.video?.source === "upload" ? d.video.key ?? "" : "",
    videoUrl: d.video?.source === "url" ? d.video.url ?? "" : "",
    posterKey: d.poster?.key ?? "",
    posterAlt: d.poster?.alt ?? "",
    instagramUrl: d.instagramUrl ?? "",
    productId: d.productId ?? "",
    active: entry.status === "PUBLISHED",
  };
}

function toPayload(f: ReelForm) {
  return {
    title: f.title,
    caption: f.caption,
    fragranceName: f.fragranceName,
    video: f.videoSource === "upload" ? { source: "upload", key: f.videoKey } : { source: "url", url: f.videoUrl },
    poster: { key: f.posterKey, alt: f.posterAlt },
    instagramUrl: f.instagramUrl,
    ...(f.productId ? { productId: f.productId } : {}),
  };
}

/** Field errors keyed like the form (video.key → video, poster.alt → posterAlt, …). */
function formErrors(f: ReelForm): Record<string, string> {
  const parsed = reelPayloadSchema.safeParse(toPayload(f));
  if (parsed.success) return {};
  const out: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const p = issue.path.join(".");
    const key = p.startsWith("video") ? "video" : p === "poster.key" ? "poster" : p === "poster.alt" ? "posterAlt" : p;
    out[key] ??= issue.message;
  }
  if (out.video && f.videoSource === "upload" && !f.videoKey) out.video = "Choose or upload a video";
  if (out.poster && !f.posterKey) out.poster = "Choose or upload a poster image";
  return out;
}

function ReelEditor({
  entry,
  library,
  products,
  onClose,
  onSaved,
}: {
  entry: CmsEntry | null;
  library: MediaLibraryState;
  products: ProductOption[];
  onClose: () => void;
  onSaved: (entry: CmsEntry, message: string) => void;
}) {
  const initial = useMemo(() => (entry ? toForm(entry) : EMPTY_FORM), [entry]);
  const [form, setForm] = useState<ReelForm>(initial);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<ReelForm>) => setForm((f) => ({ ...f, ...patch }));
  const errors = showErrors ? formErrors(form) : {};
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  useUnsavedChangesWarning(dirty);
  const videoLimit = library.limits ? formatBytes(library.limits.videoBytes) : "4 MB";

  const save = async () => {
    setError(null);
    if (Object.keys(formErrors(form)).length > 0) {
      setShowErrors(true);
      setError("Please fix the highlighted fields.");
      return;
    }
    setBusy(true);
    try {
      const draft = reelPayloadSchema.parse(toPayload(form)) as unknown as Record<string, unknown>;
      let current = entry
        ? await cmsApi.patch(REELS_MODULE.id, entry.id, { action: "saveDraft", version: entry.version, draft })
        : await cmsApi.create(REELS_MODULE.id, draft);
      if (form.active) current = await cmsApi.patch(REELS_MODULE.id, current.id, { action: "publish", version: current.version });
      else if (current.status === "PUBLISHED") current = await cmsApi.patch(REELS_MODULE.id, current.id, { action: "unpublish", version: current.version });
      onSaved(current, form.active ? (entry ? "Reel saved and shown on the homepage." : "Reel added and shown on the homepage.") : "Reel saved as inactive (not shown on the homepage).");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-brand-gold/40 bg-white p-4 shadow-[0_10px_30px_-18px_rgba(60,45,20,0.35)] sm:p-6" aria-labelledby="reel-editor-title" data-reel-editor>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="reel-editor-title" className="font-serif text-[22px] font-semibold text-brand-black">{entry ? "Edit Reel" : "Add a Reel"}</h2>
        <label className="flex items-center gap-2.5 text-[13.5px] font-semibold">
          <input type="checkbox" className="size-4 accent-[#161513]" checked={form.active} onChange={(e) => set({ active: e.target.checked })} data-field="active" />
          Active (shown on the homepage)
        </label>
      </div>
      {error ? <div className="mt-4"><FeedbackBanner feedback={{ tone: "error", message: error }} onDismiss={() => setError(null)} /></div> : null}

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <TextField id="reel-title" label="Title" required value={form.title} max={80} error={errors.title} onChange={(title) => set({ title })} placeholder="e.g. Black Velvet, after dark" />
          <TextField id="reel-caption" label="Caption" value={form.caption} max={200} multiline error={errors.caption} onChange={(caption) => set({ caption })} />
          <TextField id="reel-fragrance" label="Fragrance name" value={form.fragranceName} max={80} error={errors.fragranceName} onChange={(fragranceName) => set({ fragranceName })} help="Optional small label above the title." />
          <TextField
            id="reel-instagram"
            label="Instagram link"
            required
            value={form.instagramUrl}
            max={300}
            error={errors.instagramUrl}
            onChange={(instagramUrl) => set({ instagramUrl })}
            placeholder="https://www.instagram.com/reel/…"
          />
          <label className="block">
            <span className="text-[13px] font-semibold text-brand-black">Linked product <span className="font-normal text-brand-text/50">(optional)</span></span>
            <select className={`${INPUT} mt-1.5 h-10`} value={form.productId} onChange={(e) => set({ productId: e.target.value })} data-field="product">
              <option value="">No product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.productTypeId === "roll-on" ? " (Roll-On)" : ""}
                  {p.status !== "ACTIVE" ? " – hidden" : ""}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[12px] text-brand-text/55">Adds a “Shop” link under the Reel while the product is visible on the website.</span>
          </label>
        </div>

        <div className="space-y-4">
          <div>
            <FilterTabs
              label="Video source"
              value={form.videoSource}
              onChange={(videoSource) => set({ videoSource })}
              options={[
                { value: "upload", label: "Upload video" },
                { value: "url", label: "Video link" },
              ]}
            />
          </div>
          {form.videoSource === "upload" ? (
            <MediaField
              id="reel-video"
              label="Video"
              kind="video"
              required
              folder="videos"
              library={library}
              value={form.videoKey || undefined}
              error={errors.video}
              help={`Vertical 9:16 MP4 or WebM, up to ${videoLimit}. Larger files: use a video link instead.`}
              onChange={(key) => set({ videoKey: key ?? "" })}
            />
          ) : (
            <TextField
              id="reel-video-url"
              label="Video link"
              required
              value={form.videoUrl}
              max={500}
              error={errors.video}
              help="A direct https link to an MP4 or WebM file (not an Instagram page)."
              onChange={(videoUrl) => set({ videoUrl })}
            />
          )}
          <MediaField
            id="reel-poster"
            label="Poster image"
            kind="image"
            required
            folder="general"
            library={library}
            value={form.posterKey || undefined}
            error={errors.poster}
            help="Shown before the video plays and while it loads. Vertical 9:16 works best (e.g. 1080×1920)."
            onChange={(key, asset) => set({ posterKey: key ?? "", ...(key && !form.posterAlt && asset?.alt ? { posterAlt: asset.alt } : {}) })}
          >
            <TextField id="reel-poster-alt" label="Describe the poster image" required value={form.posterAlt} max={200} error={errors.posterAlt} onChange={(posterAlt) => set({ posterAlt })} />
          </MediaField>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-2.5 border-t border-[#efe6d4] pt-4">
        <button type="button" onClick={onClose} disabled={busy} className={BTN_SECONDARY}>
          Cancel
        </button>
        <button type="button" onClick={() => void save()} disabled={busy} className={BTN_PRIMARY} data-action="save-reel">
          {busy ? <Spinner label="Saving…" /> : entry ? "Save Reel" : "Add Reel"}
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- list --- */

const posterUrl = (library: MediaLibraryState, key: string | undefined) => (key ? library.byKey.get(key)?.url ?? `${MEDIA_ROUTE}${key}` : undefined);

export function ReelsManager() {
  const library = useMediaLibrary();
  const { feedback, setFeedback, clear } = useFeedback();
  const [entries, setEntries] = useState<CmsEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [editing, setEditing] = useState<CmsEntry | "new" | null>(null);
  const [deleting, setDeleting] = useState<CmsEntry | null>(null);
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(() => [...(entries ?? [])].sort((a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id)), [entries]);

  const reload = useCallback(async () => {
    try {
      setEntries(await cmsApi.list(REELS_MODULE.id));
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void reload();
    adminFetch<{ items: ProductOption[] }>("/api/admin/products?include=variants")
      .then((r) => setProducts([...r.items].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setProducts([]));
  }, [reload]);

  const move = async (index: number, delta: -1 | 1) => {
    const to = index + delta;
    if (to < 0 || to >= sorted.length) return;
    const next = [...sorted];
    const [m] = next.splice(index, 1);
    next.splice(to, 0, m);
    setBusy(true);
    clear();
    try {
      const r = await adminFetch<{ items: CmsEntry[] }>(`/api/admin/cms/${REELS_MODULE.id}/reorder`, { method: "POST", body: JSON.stringify({ order: next.map((e) => ({ id: e.id, version: e.version })) }) });
      setEntries(r.items);
    } catch (e) {
      setFeedback({ tone: "error", message: (e as Error).message });
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (entry: CmsEntry) => {
    setBusy(true);
    clear();
    try {
      const action = entry.status === "PUBLISHED" ? "unpublish" : "publish";
      const item = await cmsApi.patch(REELS_MODULE.id, entry.id, { action, version: entry.version });
      setEntries((list) => (list ?? []).map((e) => (e.id === item.id ? item : e)));
      setFeedback({ tone: "success", message: action === "publish" ? "Reel is now active on the homepage." : "Reel is now inactive (hidden from the homepage)." });
    } catch (e) {
      setFeedback({ tone: "error", message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    clear();
    try {
      await adminFetch(`/api/admin/cms/${REELS_MODULE.id}/${encodeURIComponent(deleting.id)}?version=${deleting.version}`, { method: "DELETE" });
      setEntries((list) => (list ?? []).filter((e) => e.id !== deleting.id));
      setFeedback({ tone: "success", message: "Reel deleted. Its video and poster stay in the Media Library; delete them there if they are no longer needed." });
      setDeleting(null);
    } catch (e) {
      setFeedback({ tone: "error", message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const activeCount = sorted.filter((e) => e.status === "PUBLISHED").length;

  return (
    <div className="space-y-6" data-reels-manager>
      <PageIntro
        eyebrow="Website"
        title="Instagram Reels"
        description="Vertical videos in the “On Instagram” section of the homepage. Add Reels, choose their order, and switch them on or off. Changes appear on the website straight away."
        actions={
          editing === null ? (
            <button type="button" onClick={() => setEditing("new")} disabled={(entries?.length ?? 0) >= MAX_REELS} className={BTN_PRIMARY} data-action="add-reel">
              <Plus aria-hidden="true" className="size-4" /> Add Reel
            </button>
          ) : null
        }
      />
      <FeedbackBanner feedback={feedback} onDismiss={clear} />
      {library.error ? <FeedbackBanner feedback={{ tone: "error", message: `Media Library: ${library.error}` }} onDismiss={() => void library.reload()} /> : null}

      {editing !== null ? (
        <ReelEditor
          key={editing === "new" ? "new" : editing.id}
          entry={editing === "new" ? null : editing}
          library={library}
          products={products}
          onClose={() => setEditing(null)}
          onSaved={(item, message) => {
            setEntries((list) => {
              const others = (list ?? []).filter((e) => e.id !== item.id);
              return [...others, item];
            });
            setEditing(null);
            setFeedback({ tone: "success", message });
          }}
        />
      ) : null}

      <Card
        icon={<Clapperboard className="size-4.5" strokeWidth={1.5} />}
        title="Reels"
        description={entries ? `${entries.length} of ${MAX_REELS} · ${activeCount} active. The homepage shows active Reels in this order.` : undefined}
      >
        {loadError ? (
          <FeedbackBanner feedback={{ tone: "error", message: loadError }} onDismiss={() => void reload()} />
        ) : entries === null ? (
          <Spinner label="Loading Reels…" />
        ) : sorted.length === 0 ? (
          <EmptyState icon={<Film className="size-6" strokeWidth={1.4} />} title="No Reels yet">
            Add your first Reel: a vertical video, a poster image and its Instagram link. The homepage section appears once a Reel is active.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-[#efe6d4]" data-reels-list>
            {sorted.map((entry, i) => {
              const d = entry.draft as Partial<ReelPayload>;
              const thumb = posterUrl(library, d.poster?.key);
              const active = entry.status === "PUBLISHED";
              return (
                <li key={entry.id} className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap" data-reel-row={entry.id}>
                  <span className="w-6 text-center text-[13px] font-semibold text-brand-text/50 tabular-nums" aria-label={`Position ${i + 1}`}>{i + 1}</span>
                  <div className="relative h-[72px] w-[41px] shrink-0 overflow-hidden rounded-lg bg-brand-cream ring-1 ring-brand-gold/30">
                    {thumb ? <Image src={thumb} alt="" fill sizes="41px" className="object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-brand-black">{d.title || "Untitled Reel"}</p>
                    <p className="truncate text-[12px] text-brand-text/60">{[d.fragranceName, d.caption].filter(Boolean).join(" · ") || "No caption"}</p>
                  </div>
                  <StatusBadge tone={active ? "success" : "dark"}>{active ? "Active" : "Inactive"}</StatusBadge>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => void move(i, -1)} disabled={busy || i === 0} className={BTN_ICON} aria-label={`Move "${d.title}" up`}>
                      <ArrowUp aria-hidden="true" className="size-4" />
                    </button>
                    <button type="button" onClick={() => void move(i, 1)} disabled={busy || i === sorted.length - 1} className={BTN_ICON} aria-label={`Move "${d.title}" down`}>
                      <ArrowDown aria-hidden="true" className="size-4" />
                    </button>
                    <button type="button" onClick={() => void toggleActive(entry)} disabled={busy} className={BTN_ICON} aria-label={active ? `Deactivate "${d.title}"` : `Activate "${d.title}"`} title={active ? "Deactivate" : "Activate"} data-action="toggle-reel">
                      {active ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
                    </button>
                    <button type="button" onClick={() => setEditing(entry)} disabled={busy} className={BTN_ICON} aria-label={`Edit "${d.title}"`} data-action="edit-reel">
                      <Pencil aria-hidden="true" className="size-4" />
                    </button>
                    <button type="button" onClick={() => setDeleting(entry)} disabled={busy} className={`${BTN_ICON} hover:border-[#9a3b2b] hover:text-[#9a3b2b]`} aria-label={`Delete "${d.title}"`} data-action="delete-reel">
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <SectionSettings />

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this Reel?"
        confirmLabel={busy ? "Deleting…" : "Delete Reel"}
        busy={busy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      >
        <p className="text-[13.5px]">
          “{(deleting?.draft as Partial<ReelPayload> | undefined)?.title}” will be removed from the homepage and from this list. Its video and poster stay in the Media Library (other pages may use them).
        </p>
      </ConfirmDialog>
    </div>
  );
}
