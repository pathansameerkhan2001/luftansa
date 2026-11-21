"use client";

/**
 * Media selection for CMS pages (Phase 3B):
 *   useMediaLibrary   loads the Media Library once per page (thumbnails, limits)
 *   MediaPicker       dialog: choose an existing image/video, or upload one in place
 *   MediaField        a form field showing the chosen file, with Choose/Replace/Remove
 *   FocalPointPicker  click (or arrow keys / number inputs) to set the crop focus
 *
 * Content stores only the object key. Removing a file from a field only drops
 * the reference: files are deleted solely through the Media Library's
 * two-step deletion, which is blocked while any CMS content uses the file.
 */
import Image from "next/image";
import { AlertTriangle, Check, Clapperboard, Crosshair, ImageIcon, Loader2, Replace, Trash2, UploadCloud, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { formatBytes, IMAGE_ACCEPT, uploadToMediaLibrary, VIDEO_ACCEPT, type UploadedMedia, type UploadLimits } from "@/lib/media/client-upload";
import type { FocalPoint } from "@/lib/cms/fields";
import { ADMIN_FOCUS, adminFetch, BTN_PRIMARY, BTN_SECONDARY, EmptyState, INPUT, SearchField, Spinner } from "./ui";

export interface LibraryAsset {
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
  status: "ACTIVE" | "PENDING_DELETION";
  createdAt: string;
}

interface LibraryResponse {
  items: LibraryAsset[];
  environment: { limits: UploadLimits };
}

export function useMediaLibrary() {
  const [items, setItems] = useState<LibraryAsset[] | null>(null);
  const [limits, setLimits] = useState<UploadLimits | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      const data = await adminFetch<LibraryResponse>("/api/admin/media");
      setItems(data.items);
      setLimits(data.environment.limits);
      setError(null);
      return data.items;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  const byKey = useMemo(() => new Map((items ?? []).map((m) => [m.key, m])), [items]);
  return { items, limits, error, reload, byKey };
}
export type MediaLibraryState = ReturnType<typeof useMediaLibrary>;

const fileName = (key: string) => key.split("/").pop()?.replace(/^\d{10,}-/, "") ?? key;

function describe(asset: LibraryAsset): string {
  const parts = [asset.width && asset.height ? `${asset.width}×${asset.height}` : null, asset.durationSeconds ? `${asset.durationSeconds}s` : null, formatBytes(asset.sizeBytes)];
  return parts.filter(Boolean).join(" · ");
}

function Thumb({ asset, url, kind, className = "" }: { asset?: LibraryAsset; url: string; kind: "image" | "video"; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-[radial-gradient(110%_80%_at_50%_40%,#ffffff_0%,var(--brand-cream)_100%)] ${className}`}>
      {kind === "image" ? (
        <Image src={url} alt={asset?.alt ?? ""} fill sizes="(min-width: 1024px) 240px, 45vw" className="object-cover" />
      ) : (
        <>
          <video src={`${url}#t=0.1`} preload="metadata" muted playsInline aria-hidden="true" className="absolute inset-0 size-full object-cover" />
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] text-white">
            <Clapperboard aria-hidden="true" className="size-3" /> Video
          </span>
        </>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- picker --- */

export function MediaPicker({
  open,
  kind,
  folder,
  library,
  selectedKey,
  onClose,
  onSelect,
}: {
  open: boolean;
  kind: "image" | "video";
  /** Media Library folder for uploads made from this picker. */
  folder: string;
  library: MediaLibraryState;
  selectedKey?: string;
  onClose: () => void;
  onSelect: (asset: LibraryAsset) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      setUploadError(null);
      void library.reload();
    }
    if (!open && d.open) d.close();
    // library.reload is stable; reloading on open keeps the list current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const q = query.trim().toLowerCase();
  const assets = (library.items ?? []).filter(
    (m) => m.kind === kind && m.status === "ACTIVE" && (!q || [m.originalFilename, m.key, m.alt ?? "", m.folder].some((s) => s.toLowerCase().includes(q))),
  );

  const upload = async (file: File | undefined) => {
    if (!file || !library.limits) return;
    setUploading(true);
    setUploadError(null);
    try {
      const done = await uploadToMediaLibrary(file, folder, library.limits, (form) => adminFetch<UploadedMedia>("/api/admin/media/upload", { method: "POST", body: form }), kind === "image" ? IMAGE_ACCEPT : VIDEO_ACCEPT);
      const items = await library.reload();
      const asset = items?.find((m) => m.key === done.key);
      if (asset) onSelect(asset);
      else setUploadError("Uploaded, but the file could not be found in the library. Reload and choose it from the list.");
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const noun = kind === "image" ? "image" : "video";
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!uploading) onClose();
      }}
      aria-labelledby="media-picker-title"
      className="m-auto h-[min(760px,calc(100dvh-32px))] w-[min(980px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-[#e3d6bd] bg-[#fffdf8] p-0 text-brand-black shadow-2xl backdrop:bg-black/50"
      data-media-picker={kind}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-[#e3d6bd] px-5 py-4">
          <div>
            <h2 id="media-picker-title" className="font-serif text-[22px] font-semibold">
              Choose {kind === "image" ? "an image" : "a video"}
            </h2>
            <p className="mt-0.5 text-[12.5px] text-brand-text/60">
              From the Media Library, or upload a new {noun}.
              {kind === "video" && library.limits ? ` Videos up to ${formatBytes(library.limits.videoBytes)} (MP4 or WebM).` : ""}
              {kind === "image" ? " JPEG, PNG or WebP; large photos are compressed automatically." : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={uploading} aria-label="Close" className={`-m-1 rounded-lg p-1.5 text-brand-text/60 hover:text-brand-black ${ADMIN_FOCUS}`}>
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 px-5 py-3">
          <SearchField value={query} onChange={setQuery} placeholder={`Search ${noun}s by name or alt text`} label={`Search ${noun}s`} />
          <input ref={inputRef} type="file" accept={kind === "image" ? IMAGE_ACCEPT : VIDEO_ACCEPT} className="sr-only" tabIndex={-1} onChange={(e) => void upload(e.target.files?.[0])} data-picker-upload />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading || !library.limits} className={BTN_PRIMARY}>
            {uploading ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <UploadCloud aria-hidden="true" className="size-4" />}
            {uploading ? "Uploading…" : `Upload ${noun}`}
          </button>
        </div>
        <div role="status" aria-live="polite" className="px-5">
          {uploadError ? (
            <p className="mb-2 flex items-start gap-2 rounded-xl border border-[#e2b4ab] bg-[#fbeeeb] px-3 py-2 text-[13px] text-[#8a2f22]">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {uploadError}
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {library.items === null ? (
            library.error ? <p className="text-[13.5px] text-[#8a2f22]">{library.error}</p> : <Spinner label="Loading the Media Library…" />
          ) : assets.length === 0 ? (
            <EmptyState icon={kind === "image" ? <ImageIcon className="size-5" /> : <Clapperboard className="size-5" />} title={q ? `No ${noun}s match “${query}”` : `No ${noun}s in the Media Library yet`}>
              {q ? "Try another search." : `Upload ${kind === "image" ? "an image" : "a video"} to use it here.`}
            </EmptyState>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {assets.map((m) => {
                const selected = m.key === selectedKey;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(m)}
                      aria-pressed={selected}
                      className={`group block w-full overflow-hidden rounded-xl border bg-white text-left transition-colors ${selected ? "border-brand-black ring-2 ring-brand-gold" : "border-[#e3d6bd] hover:border-brand-gold"} ${ADMIN_FOCUS}`}
                    >
                      <Thumb asset={m} url={m.url} kind={m.kind} className="aspect-[4/3]" />
                      <span className="block px-2.5 py-2">
                        <span className="flex items-center gap-1 truncate text-[12.5px] font-semibold text-brand-black">
                          {selected ? <Check aria-hidden="true" className="size-3.5 shrink-0 text-[#2f5f2a]" /> : null}
                          <span className="truncate">{m.originalFilename}</span>
                        </span>
                        <span className="block truncate text-[11.5px] text-brand-text/55">{describe(m)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </dialog>
  );
}

/* ---------------------------------------------------------------- field --- */

export function MediaField({
  id,
  label,
  kind,
  value,
  required,
  help,
  error,
  folder,
  library,
  onChange,
  children,
}: {
  id: string;
  label: string;
  kind: "image" | "video";
  value?: string;
  required?: boolean;
  help?: ReactNode;
  error?: string;
  folder: string;
  library: MediaLibraryState;
  onChange: (key: string | undefined, asset?: LibraryAsset) => void;
  /** Extra inputs for the chosen file (alt text, focal point). */
  children?: ReactNode;
}) {
  const [picking, setPicking] = useState(false);
  const asset = value ? library.byKey.get(value) : undefined;
  const missing = Boolean(value && library.items && !asset);
  const url = asset?.url ?? (value ? `/media/${value.split("/").map(encodeURIComponent).join("/")}` : undefined);

  return (
    <fieldset className="min-w-0" aria-describedby={error ? `${id}-error` : undefined} data-media-field={id}>
      <legend className="text-[13.5px] font-semibold text-brand-black">
        {label} {required ? <span className="text-[#8a2f22]">*</span> : <span className="font-normal text-brand-text/50">(optional)</span>}
      </legend>
      {help ? <p className="mt-0.5 text-[12.5px] leading-snug text-brand-text/60">{help}</p> : null}

      {value && url ? (
        <div className="mt-2.5 overflow-hidden rounded-xl border border-[#e3d6bd] bg-white">
          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
            <Thumb asset={asset} url={url} kind={kind} className="aspect-[16/10] w-full shrink-0 rounded-lg sm:w-44" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold text-brand-black">{asset?.originalFilename ?? fileName(value)}</p>
              <p className="truncate text-[12px] text-brand-text/55">{asset ? describe(asset) : value}</p>
              {missing ? (
                <p className="mt-1 flex items-start gap-1.5 text-[12.5px] text-[#8a2f22]">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /> This file is not in the Media Library. Choose another.
                </p>
              ) : null}
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button type="button" onClick={() => setPicking(true)} className={`${BTN_SECONDARY} h-9`}>
                  <Replace aria-hidden="true" className="size-4" /> Replace
                </button>
                <button type="button" onClick={() => onChange(undefined)} className={`${BTN_SECONDARY} h-9`} aria-label={`Remove ${label.toLowerCase()}`}>
                  <Trash2 aria-hidden="true" className="size-4" /> Remove
                </button>
              </div>
            </div>
          </div>
          {children ? <div className="space-y-3 border-t border-[#efe5d1] bg-[#fffdf8] p-3">{children}</div> : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className={`mt-2.5 flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-7 text-center transition-colors ${error ? "border-[#c97f70] bg-[#fbeeeb]" : "border-[#d9c79f] bg-[#fffdf8] hover:border-brand-black"} ${ADMIN_FOCUS}`}
        >
          {kind === "image" ? <ImageIcon aria-hidden="true" className="size-6 text-brand-text/45" strokeWidth={1.5} /> : <Clapperboard aria-hidden="true" className="size-6 text-brand-text/45" strokeWidth={1.5} />}
          <span className="text-[13.5px] font-semibold text-brand-black">Choose {kind === "image" ? "an image" : "a video"}</span>
          <span className="text-[12px] text-brand-text/55">From the Media Library, or upload a new one</span>
        </button>
      )}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[12.5px] text-[#8a2f22]">
          {error}
        </p>
      ) : null}

      <MediaPicker
        open={picking}
        kind={kind}
        folder={folder}
        library={library}
        selectedKey={value}
        onClose={() => setPicking(false)}
        onSelect={(m) => {
          onChange(m.key, m);
          setPicking(false);
        }}
      />
    </fieldset>
  );
}

/* ---------------------------------------------------------- focal point --- */

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

export function FocalPointPicker({ id, src, value, onChange, label }: { id: string; src: string; value: FocalPoint; onChange: (v: FocalPoint) => void; label: string }) {
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onChange({ x: clamp(((e.clientX - r.left) / r.width) * 100), y: clamp(((e.clientY - r.top) / r.height) * 100) });
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 2;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    onChange({ x: clamp(value.x + m[0]), y: clamp(value.y + m[1]) });
  };
  return (
    <div data-focal-point={id}>
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-brand-black">
        <Crosshair aria-hidden="true" className="size-4 text-brand-text/60" /> {label}
      </p>
      <p className="mt-0.5 text-[12px] leading-snug text-brand-text/60">Click the part of the image that must stay visible when it is cropped (arrow keys move it; Shift for bigger steps).</p>
      <div className="mt-2 flex flex-wrap items-start gap-3">
        <div
          role="group"
          tabIndex={0}
          aria-label={`${label}: ${value.x}% across, ${value.y}% down. Use the arrow keys to move it.`}
          onClick={onClick}
          onKeyDown={onKeyDown}
          className={`relative inline-block cursor-crosshair overflow-hidden rounded-lg border border-[#e3d6bd] ${ADMIN_FOCUS}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- natural-size preview so click coordinates map exactly onto the image */}
          <img src={src} alt="" draggable={false} className="block max-h-56 w-auto max-w-full select-none" />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand-gold/70 shadow-[0_0_0_1px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.4)]"
            style={{ left: `${value.x}%`, top: `${value.y}%` }}
          />
        </div>
        <div className="flex gap-2">
          {(["x", "y"] as const).map((axis) => (
            <label key={axis} className="block w-24 text-[12px] text-brand-text/70">
              {axis === "x" ? "Across (%)" : "Down (%)"}
              <input
                type="number"
                min={0}
                max={100}
                value={value[axis]}
                onChange={(e) => onChange({ ...value, [axis]: clamp(Number(e.target.value) || 0) })}
                className={`${INPUT} mt-1 h-9`}
                data-focal-input={`${id}-${axis}`}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
