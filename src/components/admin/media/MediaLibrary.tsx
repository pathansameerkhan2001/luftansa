"use client";

import Image from "next/image";
import { Clapperboard, Copy, FileImage, HardDrive, ImageIcon, Info, Trash2, UploadCloud, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { formatBytes, UPLOAD_ACCEPT, uploadToMediaLibrary, type UploadedMedia } from "@/lib/media/client-upload";
import {
  ADMIN_FOCUS, adminFetch, BTN_PRIMARY, BTN_SECONDARY, ConfirmDialog, EmptyState, FeedbackBanner, FilterTabs, INPUT, PageIntro, SearchField, Spinner, StatusBadge, useFeedback,
} from "@/components/admin/cms/ui";

/* ------------------------------------------------------------------ types --- */

interface MediaRecord {
  id: string;
  key: string;
  url: string;
  kind: "image" | "video";
  contentType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  originalFilename: string;
  folder: string;
  alt?: string;
  description?: string;
  status: "ACTIVE" | "PENDING_DELETION";
  uploadedBy: string;
  createdAt: string;
  version: number;
}
interface UsageRef { type: "product" | "content"; id: string; label: string; field: string }
interface Uncatalogued { key: string; url: string; usedBy: UsageRef[] }
interface LibraryResponse {
  items: MediaRecord[];
  uncatalogued: Uncatalogued[];
  environment: { mode: "production" | "local"; storage: "s3" | "local" | "none"; limits: { imageBytes: number; videoBytes: number }; folders: string[] };
}

type Filter = "all" | "image" | "video" | "product";
type Selected = { type: "record"; id: string } | { type: "uncatalogued"; key: string } | null;

const FOLDER_LABELS: Record<string, string> = {
  general: "General", hero: "Hero", banners: "Banners", about: "About Us", lab: "Inside the Lab", manufacturing: "Manufacturing", videos: "Videos",
};
const ACCEPT = UPLOAD_ACCEPT;

const mb = formatBytes;
const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const fileName = (key: string) => key.split("/").pop() ?? key;

/* -------------------------------------------------------------- component --- */

export function MediaLibrary() {
  const [data, setData] = useState<LibraryResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState("general");
  const [uploads, setUploads] = useState<{ name: string; state: "working" | "done" | "error"; message?: string }[]>([]);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<Selected>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { feedback, setFeedback, clear } = useFeedback();

  const load = useCallback(async () => {
    try {
      setData(await adminFetch<LibraryResponse>("/api/admin/media"));
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (files: FileList | File[]) => {
    const list = [...files];
    if (list.length === 0 || !data) return;
    clear();
    setUploads(list.map((f) => ({ name: f.name, state: "working" })));
    let ok = 0;
    for (const [i, file] of list.entries()) {
      const setState = (state: "done" | "error", message?: string) => setUploads((u) => u.map((x, j) => (j === i ? { ...x, state, message } : x)));
      try {
        await uploadToMediaLibrary(file, folder, data.environment.limits, (form) => adminFetch<UploadedMedia>("/api/admin/media/upload", { method: "POST", body: form }));
        ok++;
        setState("done");
      } catch (e) {
        setState("error", (e as Error).message);
      }
    }
    if (ok > 0) setFeedback({ tone: "success", message: `${ok} file${ok === 1 ? "" : "s"} uploaded to ${FOLDER_LABELS[folder] ?? folder}.` });
    if (ok < list.length) setFeedback({ tone: "error", message: `${list.length - ok} file${list.length - ok === 1 ? "" : "s"} could not be uploaded. See the details below.` });
    await load();
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
  };

  const counts = useMemo(() => {
    const items = data?.items ?? [];
    return {
      all: items.length + (data?.uncatalogued.length ?? 0),
      image: items.filter((m) => m.kind === "image").length + (data?.uncatalogued.length ?? 0),
      video: items.filter((m) => m.kind === "video").length,
      product: items.filter((m) => m.folder.startsWith("products/")).length + (data?.uncatalogued.length ?? 0),
    };
  }, [data]);

  const q = query.trim().toLowerCase();
  const records = (data?.items ?? []).filter((m) => {
    if (filter === "image" && m.kind !== "image") return false;
    if (filter === "video" && m.kind !== "video") return false;
    if (filter === "product" && !m.folder.startsWith("products/")) return false;
    return !q || [m.originalFilename, m.key, m.alt ?? "", m.description ?? "", m.folder].some((s) => s.toLowerCase().includes(q));
  });
  const uncatalogued = filter === "video" ? [] : (data?.uncatalogued ?? []).filter((u) => !q || u.key.toLowerCase().includes(q) || u.usedBy.some((r) => r.label.toLowerCase().includes(q)));
  const selectedRecord = selected?.type === "record" ? data?.items.find((m) => m.id === selected.id) : undefined;
  const selectedUnc = selected?.type === "uncatalogued" ? data?.uncatalogued.find((u) => u.key === selected.key) : undefined;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Media"
        title="Media Library"
        description="Every image and video used on the website. Files stay in private storage; deleting is always a separate, confirmed step and is blocked while a file is in use."
        actions={
          <button type="button" className={BTN_PRIMARY} onClick={() => inputRef.current?.click()} disabled={!data}>
            <UploadCloud aria-hidden="true" className="size-4" />
            Upload files
          </button>
        }
      />

      {data?.environment.mode === "local" ? (
        <p className="flex items-start gap-2.5 rounded-xl border border-[#e5c98f] bg-[#fdf4e2] px-4 py-3 text-[13px] text-[#6b4f22]" data-local-notice>
          <HardDrive aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            <b>Local development.</b> Files are stored on this computer ({data.environment.storage === "local" ? "local media folder" : "no storage configured"}), never in the
            production bucket.
          </span>
        </p>
      ) : null}

      <FeedbackBanner feedback={feedback} onDismiss={clear} />

      {/* Upload */}
      <section aria-labelledby="upload-heading" className="rounded-2xl border border-[#e3d6bd] bg-[#fffdf8] p-5 sm:p-6">
        <h2 id="upload-heading" className="text-[12px] font-semibold tracking-[0.16em] text-[#7a5a2b] uppercase">
          Upload
        </h2>
        <div className="mt-3 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
          <label className="block">
            <span className="text-[13px] font-semibold">Folder</span>
            <select value={folder} onChange={(e) => setFolder(e.target.value)} className={`${INPUT} mt-1.5 h-10`}>
              {(data?.environment.folders ?? ["general"]).map((f) => (
                <option key={f} value={f}>
                  {FOLDER_LABELS[f] ?? f}
                </option>
              ))}
            </select>
            <span className="mt-1.5 block text-[12px] text-brand-text/60">Product photos are uploaded from each product.</span>
          </label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors ${dragging ? "border-brand-black bg-brand-cream" : "border-[#d9c79f] bg-white"}`}
          >
            <UploadCloud aria-hidden="true" className="size-7 text-brand-gold" strokeWidth={1.5} />
            <p className="mt-2 text-[14px] font-medium">
              Drag files here or{" "}
              <button type="button" onClick={() => inputRef.current?.click()} className={`font-semibold underline decoration-brand-gold underline-offset-4 ${ADMIN_FOCUS}`}>
                choose files
              </button>
            </p>
            <p className="mt-1 text-[12px] text-brand-text/60">
              JPEG, PNG, WebP (compressed automatically) · MP4, WebM up to {data ? mb(data.environment.limits.videoBytes) : "4 MB"}
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="sr-only"
              aria-label="Choose files to upload"
              data-media-input
              onChange={(e) => {
                if (e.target.files) void upload(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </div>
        {uploads.length > 0 ? (
          <ul className="mt-4 space-y-1.5 text-[13px]" aria-label="Upload progress">
            {uploads.map((u, i) => (
              <li key={`${u.name}-${i}`} className="flex flex-wrap items-center gap-2">
                {u.state === "working" ? <Spinner label="" /> : <StatusBadge tone={u.state === "done" ? "success" : "danger"}>{u.state === "done" ? "Uploaded" : "Failed"}</StatusBadge>}
                <span className="font-medium">{u.name}</span>
                {u.message ? <span className="text-[#8a2f22]">{u.message}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* Browse */}
      <section aria-labelledby="browse-heading" className="space-y-4">
        <h2 id="browse-heading" className="sr-only">
          Files
        </h2>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchField value={query} onChange={setQuery} placeholder="Search by name, alt text, folder…" label="Search media" />
          <FilterTabs
            label="Filter media"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: counts.all },
              { value: "image", label: "Images", count: counts.image },
              { value: "video", label: "Videos", count: counts.video },
              { value: "product", label: "Product images", count: counts.product },
            ]}
          />
        </div>

        {loadError ? (
          <EmptyState icon={<Info className="size-5" />} title="The library could not be loaded">
            {loadError}{" "}
            <button type="button" className="font-semibold underline" onClick={() => void load()}>
              Try again
            </button>
          </EmptyState>
        ) : !data ? (
          <div className="py-10 text-center">
            <Spinner label="Loading media…" />
          </div>
        ) : records.length + uncatalogued.length === 0 ? (
          <EmptyState icon={<ImageIcon className="size-5" />} title={q || filter !== "all" ? "No files match" : "No files yet"}>
            {q || filter !== "all" ? "Try another search or filter." : "Upload images and videos for the website here."}
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" data-media-grid>
            {records.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setSelected({ type: "record", id: m.id })}
                  className={`group block w-full overflow-hidden rounded-2xl border bg-white text-left transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(60,45,20,0.35)] ${ADMIN_FOCUS} ${m.status === "PENDING_DELETION" ? "border-[#e2b4ab]" : "border-[#e3d6bd]"}`}
                  data-media-card
                >
                  <MediaThumb kind={m.kind} url={m.url} alt={m.alt ?? ""} />
                  <div className="space-y-1.5 p-3">
                    <p className="truncate text-[13px] font-semibold" title={m.originalFilename}>
                      {m.originalFilename}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-brand-text/60">
                      <StatusBadge tone={m.kind === "video" ? "dark" : "neutral"}>{m.kind === "video" ? "Video" : "Image"}</StatusBadge>
                      {m.status === "PENDING_DELETION" ? <StatusBadge tone="danger">Deletion pending</StatusBadge> : null}
                      {m.kind === "image" && !m.alt ? <StatusBadge tone="warning">No alt text</StatusBadge> : null}
                    </div>
                    <p className="text-[11.5px] text-brand-text/55 tabular-nums">
                      {mb(m.sizeBytes)} · {dateFmt.format(new Date(m.createdAt))}
                    </p>
                  </div>
                </button>
              </li>
            ))}
            {uncatalogued.map((u) => (
              <li key={u.key}>
                <button
                  type="button"
                  onClick={() => setSelected({ type: "uncatalogued", key: u.key })}
                  className={`block w-full overflow-hidden rounded-2xl border border-[#e3d6bd] bg-white text-left ${ADMIN_FOCUS}`}
                  data-media-card
                >
                  <MediaThumb kind="image" url={u.url} alt="" />
                  <div className="space-y-1.5 p-3">
                    <p className="truncate text-[13px] font-semibold">{fileName(u.key)}</p>
                    <StatusBadge tone="success">In use · {u.usedBy[0]?.label}</StatusBadge>
                    <p className="text-[11.5px] text-brand-text/55">Product image</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedRecord ? (
        <MediaDetail
          key={selectedRecord.id + selectedRecord.version}
          item={selectedRecord}
          onClose={() => setSelected(null)}
          onChanged={async (message, closeAfter) => {
            setFeedback({ tone: "success", message });
            if (closeAfter) setSelected(null);
            await load();
          }}
          onError={(message) => setFeedback({ tone: "error", message })}
        />
      ) : null}
      {selectedUnc ? <UncataloguedDetail item={selectedUnc} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function MediaThumb({ kind, url, alt }: { kind: "image" | "video"; url: string; alt: string }) {
  return (
    <div className="relative aspect-square bg-[radial-gradient(110%_80%_at_50%_40%,#ffffff_0%,var(--brand-cream)_100%)]">
      {kind === "image" ? (
        <Image src={url} alt={alt} fill sizes="(min-width: 1280px) 220px, (min-width: 640px) 30vw, 45vw" className="object-contain p-2" />
      ) : (
        <>
          <video src={`${url}#t=0.1`} preload="metadata" muted playsInline className="absolute inset-0 size-full object-cover" aria-hidden="true" />
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] text-white">
            <Clapperboard aria-hidden="true" className="size-3" /> Video
          </span>
        </>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- detail --- */

function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={title}
      className="m-0 ml-auto h-dvh max-h-none w-[min(520px,100vw)] max-w-none overflow-y-auto bg-[#fffdf8] p-0 text-brand-black shadow-2xl backdrop:bg-black/40"
      data-media-detail
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e3d6bd] bg-[#fffdf8]/95 px-5 py-3.5 backdrop-blur">
        <h2 className="truncate pr-4 font-serif text-[20px] font-semibold">{title}</h2>
        <button type="button" onClick={() => ref.current?.close()} aria-label="Close details" className={`inline-flex size-9 items-center justify-center rounded-lg hover:bg-black/5 ${ADMIN_FOCUS}`}>
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>
      <div className="space-y-5 p-5">{children}</div>
    </dialog>
  );
}

function InfoList({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y divide-[#f0e6d2] rounded-xl border border-[#e3d6bd] bg-white px-4 text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 py-2.5">
          <dt className="text-brand-text/60">{k}</dt>
          <dd className="min-w-0 text-right font-medium break-all">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function UsageList({ usage }: { usage: UsageRef[] | null }) {
  if (usage === null) return <Spinner label="Checking where this file is used…" />;
  if (usage.length === 0) return <p className="text-[13px] text-brand-text/65">Not used anywhere on the website.</p>;
  return (
    <ul className="space-y-1.5 text-[13px]">
      {usage.map((u, i) => (
        <li key={i} className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="success">{u.type === "product" ? "Product" : "Content"}</StatusBadge>
          <span className="font-medium">{u.label}</span>
          <span className="text-brand-text/60">· {u.field}</span>
        </li>
      ))}
    </ul>
  );
}

function MediaDetail({
  item, onClose, onChanged, onError,
}: {
  item: MediaRecord;
  onClose: () => void;
  onChanged: (message: string, closeAfter?: boolean) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [alt, setAlt] = useState(item.alt ?? "");
  const [description, setDescription] = useState(item.description ?? "");
  const [usage, setUsage] = useState<UsageRef[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<null | "request" | "confirm">(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    adminFetch<{ usage: UsageRef[] }>(`/api/admin/media/${item.id}`)
      .then((r) => setUsage(r.usage))
      .catch(() => setUsage([]));
  }, [item.id]);

  const dirty = alt !== (item.alt ?? "") || description !== (item.description ?? "");
  const save = async () => {
    setSaving(true);
    try {
      await adminFetch(`/api/admin/media/${item.id}`, { method: "PATCH", body: JSON.stringify({ version: item.version, alt, description }) });
      await onChanged("Details saved.");
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const deletion = async (action: "request" | "cancel" | "confirm") => {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/media/${item.id}/deletion`, { method: "POST", body: JSON.stringify({ action, version: item.version }) });
      setConfirm(null);
      await onChanged(
        action === "request" ? "Marked for deletion. Confirm to delete it permanently, or keep it." : action === "cancel" ? "The file will be kept." : "The file was permanently deleted.",
        action === "confirm",
      );
    } catch (e) {
      setConfirm(null);
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const inUse = (usage?.length ?? 0) > 0;
  const pending = item.status === "PENDING_DELETION";

  return (
    <Drawer title={item.originalFilename} onClose={onClose}>
      <div className="overflow-hidden rounded-xl border border-[#e3d6bd] bg-[radial-gradient(110%_80%_at_50%_40%,#ffffff_0%,var(--brand-cream)_100%)]">
        {item.kind === "image" ? (
          <div className="relative aspect-[4/3]">
            <Image src={item.url} alt={item.alt ?? ""} fill sizes="480px" className="object-contain p-3" />
          </div>
        ) : (
          <video src={item.url} controls muted playsInline preload="metadata" className="aspect-video w-full bg-black" data-media-video />
        )}
      </div>

      {pending ? (
        <div className="rounded-xl border border-[#e2b4ab] bg-[#fbeeeb] p-4 text-[13.5px] text-[#8a2f22]" data-pending-deletion>
          <p className="font-semibold">Deletion requested</p>
          <p className="mt-1">Nothing has been deleted yet. Confirm to remove the file permanently, or keep it.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => void deletion("cancel")}>
              Keep file
            </button>
            <button type="button" className={`${BTN_SECONDARY} !border-[#9a3b2b] !text-[#9a3b2b]`} disabled={busy || inUse} onClick={() => setConfirm("confirm")}>
              <Trash2 aria-hidden="true" className="size-4" /> Delete permanently
            </button>
          </div>
        </div>
      ) : null}

      <section aria-labelledby="details-heading" className="space-y-3">
        <h3 id="details-heading" className="text-[12px] font-semibold tracking-[0.16em] text-[#7a5a2b] uppercase">
          Details
        </h3>
        {item.kind === "image" ? (
          <label className="block">
            <span className="text-[13px] font-semibold">Alt text</span>
            <span className="ml-1.5 text-[12px] text-brand-text/55">Describes the image for screen readers and search engines</span>
            <input value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={300} className={`${INPUT} mt-1.5`} placeholder="e.g. Black Velvet 100 ml bottle on ivory silk" />
          </label>
        ) : null}
        <label className="block">
          <span className="text-[13px] font-semibold">Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={3} className={`${INPUT} mt-1.5`} placeholder="Internal note about this file (optional)" />
        </label>
        <button type="button" className={BTN_PRIMARY} disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save details"}
        </button>
      </section>

      <InfoList
        rows={[
          ["Type", `${item.kind === "image" ? "Image" : "Video"} · ${item.contentType}`],
          ["File size", mb(item.sizeBytes)],
          ...(item.width && item.height ? ([["Dimensions", `${item.width} × ${item.height}px`]] as [string, string][]) : []),
          ...(item.durationSeconds ? ([["Duration", `${item.durationSeconds.toFixed(1)} s`]] as [string, string][]) : []),
          ["Folder", FOLDER_LABELS[item.folder] ?? item.folder],
          ["Uploaded", `${dateFmt.format(new Date(item.createdAt))} by ${item.uploadedBy}`],
          [
            "File URL",
            <button
              key="copy"
              type="button"
              className={`inline-flex items-center gap-1 underline decoration-brand-gold underline-offset-4 ${ADMIN_FOCUS}`}
              onClick={() => {
                void navigator.clipboard?.writeText(item.url);
                setCopied(true);
              }}
            >
              <Copy aria-hidden="true" className="size-3.5" /> {copied ? "Copied" : item.url}
            </button>,
          ],
        ]}
      />

      <section aria-labelledby="usage-heading" className="space-y-2">
        <h3 id="usage-heading" className="text-[12px] font-semibold tracking-[0.16em] text-[#7a5a2b] uppercase">
          Where it is used
        </h3>
        <UsageList usage={usage} />
      </section>

      {!pending ? (
        <section className="border-t border-[#f0e6d2] pt-4">
          <button type="button" className={`${BTN_SECONDARY} !text-[#9a3b2b]`} disabled={usage === null || inUse} onClick={() => setConfirm("request")} data-request-delete>
            <Trash2 aria-hidden="true" className="size-4" /> Delete…
          </button>
          {inUse ? <p className="mt-2 text-[12.5px] text-brand-text/65">This file is in use, so it cannot be deleted. Remove it from the items above first.</p> : null}
        </section>
      ) : null}

      <ConfirmDialog
        open={confirm === "request"}
        title="Delete this file?"
        confirmLabel="Mark for deletion"
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void deletion("request")}
      >
        This is step 1 of 2. The file is only marked for deletion and stays available until you confirm the permanent deletion.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "confirm"}
        title="Permanently delete?"
        confirmLabel="Delete permanently"
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void deletion("confirm")}
      >
        <b>{item.originalFilename}</b> will be removed from storage. This cannot be undone.
      </ConfirmDialog>
    </Drawer>
  );
}

function UncataloguedDetail({ item, onClose }: { item: Uncatalogued; onClose: () => void }) {
  return (
    <Drawer title={fileName(item.key)} onClose={onClose}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-[#e3d6bd] bg-brand-cream">
        <Image src={item.url} alt="" fill sizes="480px" className="object-contain p-3" />
      </div>
      <p className="flex items-start gap-2 rounded-xl border border-[#e3d6bd] bg-white p-3.5 text-[13px] text-brand-text/75">
        <FileImage aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-gold" />
        A product photo uploaded before the Media Library existed. It is shown here so every file in use is visible. Manage it from its product.
      </p>
      <InfoList rows={[["Storage key", item.key]]} />
      <section className="space-y-2">
        <h3 className="text-[12px] font-semibold tracking-[0.16em] text-[#7a5a2b] uppercase">Where it is used</h3>
        <UsageList usage={item.usedBy} />
      </section>
    </Drawer>
  );
}
