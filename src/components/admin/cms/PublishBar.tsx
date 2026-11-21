"use client";

/**
 * Publishing controls shared by every CMS page (Phase 3B).
 *
 * Status, in the editor's words:
 *   Not live yet          nothing has been published; the site shows its default content
 *   Live                  the published version is on the site
 *   Live · changes saved  a newer draft is saved but not published yet
 *   Inactive              deactivated: hidden on the site (the draft is kept)
 * "Unsaved changes" is shown separately while the form differs from the saved draft.
 */
import { Eye, EyeOff, Loader2, Monitor, Rocket, Save, Smartphone, Undo2 } from "lucide-react";
import { useState } from "react";
import type { Visibility } from "@/lib/cms/schemas";
import type { CmsEntry, EntryAction } from "./useCmsEntry";
import { ADMIN_FOCUS, BTN_PRIMARY, BTN_SECONDARY, ConfirmDialog, StatusBadge } from "./ui";

const dateTime = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export type PublishState = "new" | "draft" | "live" | "live-changes" | "inactive";

export function publishState(entry: CmsEntry | null): PublishState {
  if (!entry) return "new";
  if (entry.status === "UNPUBLISHED") return "inactive";
  if (entry.status === "PUBLISHED") return entry.hasUnpublishedChanges ? "live-changes" : "live";
  return "draft";
}

const STATE_COPY: Record<PublishState, { tone: "neutral" | "success" | "warning" | "dark"; label: string; help: string }> = {
  new: { tone: "neutral", label: "Not live yet", help: "The website shows its default content until you publish." },
  draft: { tone: "warning", label: "Draft · not live", help: "Your draft is saved. The website keeps showing its default content until you publish." },
  live: { tone: "success", label: "Live", help: "The published version is on the website." },
  "live-changes": { tone: "warning", label: "Live · draft changes saved", help: "Saved changes are not on the website yet. Publish to make them live." },
  inactive: { tone: "dark", label: "Inactive", help: "Deactivated: this section is hidden on the website. Publish to show it again." },
};

export function PublishBar({
  entry,
  dirty,
  busy,
  sectionLabel,
  onSave,
  onPublish,
  onUnpublish,
  onDiscard,
}: {
  entry: CmsEntry | null;
  /** The form differs from the saved draft. */
  dirty: boolean;
  busy: EntryAction | null;
  sectionLabel: string;
  onSave: () => void;
  onPublish: () => void;
  onUnpublish: () => Promise<unknown>;
  onDiscard: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const state = publishState(entry);
  const copy = STATE_COPY[state];
  const nothingToPublish = !dirty && state === "live";
  const working = busy !== null;

  return (
    // Sticks just below the admin top bar (h-16, sticky) and spans the full main column (its padding is px-4 / sm:px-6 / lg:px-10).
    <div className="sticky top-16 z-20 -mx-4 border-b border-[#e3d6bd] bg-[#f6f2ea]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10" data-publish-bar>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={copy.tone}>{copy.label}</StatusBadge>
            {dirty ? <StatusBadge tone="warning">Unsaved changes</StatusBadge> : null}
          </div>
          <p className="mt-1 hidden text-[12.5px] leading-snug text-brand-text/65 sm:block">
            {copy.help}
            {entry?.publishedAt && state !== "new" ? ` Last published ${dateTime.format(new Date(entry.publishedAt))}.` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty ? (
            <button type="button" onClick={onDiscard} disabled={working} className={BTN_SECONDARY}>
              <Undo2 aria-hidden="true" className="size-4" /> Discard
            </button>
          ) : null}
          <button type="button" onClick={onSave} disabled={working || !dirty} className={BTN_SECONDARY} data-action="save">
            {busy === "save" ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Save aria-hidden="true" className="size-4" />}
            Save draft
          </button>
          <button type="button" onClick={onPublish} disabled={working || nothingToPublish} className={BTN_PRIMARY} data-action="publish">
            {busy === "publish" ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Rocket aria-hidden="true" className="size-4" />}
            {state === "inactive" ? "Publish again" : dirty ? "Save & publish" : "Publish"}
          </button>
          {state === "live" || state === "live-changes" ? (
            <button type="button" onClick={() => setConfirming(true)} disabled={working} className={`${BTN_SECONDARY} max-sm:w-10 max-sm:px-0`} data-action="deactivate" aria-label="Deactivate" title="Deactivate">
              <EyeOff aria-hidden="true" className="size-4" /> <span className="max-sm:sr-only">Deactivate</span>
            </button>
          ) : null}
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        title={`Deactivate the ${sectionLabel}?`}
        confirmLabel="Deactivate"
        busy={busy === "unpublish"}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          void onUnpublish().finally(() => setConfirming(false));
        }}
      >
        The {sectionLabel.toLowerCase()} will be hidden on the website straight away. Your content is kept as a draft, and you can publish it again at any time.
      </ConfirmDialog>
    </div>
  );
}

/* ----------------------------------------------------------- visibility --- */

function Switch({ checked, disabled, onChange, label, description, Icon }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: string; description: string; Icon: typeof Monitor }) {
  return (
    <label className={`flex items-start gap-3 rounded-xl border border-[#e3d6bd] bg-white p-3.5 ${disabled ? "opacity-60" : "cursor-pointer hover:border-brand-gold"}`}>
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-text/60" strokeWidth={1.5} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold text-brand-black">{label}</span>
        <span className="block text-[12.5px] leading-snug text-brand-text/60">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed ${checked ? "bg-brand-black" : "bg-[#d9cdb5]"} ${ADMIN_FOCUS}`}
      >
        <span className={`inline-block size-5 rounded-full shadow transition-transform ${checked ? "translate-x-[22px] bg-[#e9d6ab]" : "translate-x-0.5 bg-white"}`} />
      </button>
    </label>
  );
}

/**
 * Desktop/mobile visibility. Unlike content, visibility applies to the live
 * website immediately (it arranges content rather than authoring it).
 */
export function VisibilityControls({
  value,
  disabled,
  busy,
  onChange,
}: {
  value: Visibility;
  disabled?: boolean;
  busy?: boolean;
  onChange: (v: Visibility) => void;
}) {
  return (
    <div className="space-y-2.5" data-visibility-controls>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Switch Icon={Monitor} label="Show on tablets and desktops" description="Screens 640px and wider" checked={value.desktop} disabled={disabled || busy} onChange={(desktop) => onChange({ ...value, desktop })} />
        <Switch Icon={Smartphone} label="Show on phones" description="Screens narrower than 640px" checked={value.mobile} disabled={disabled || busy} onChange={(mobile) => onChange({ ...value, mobile })} />
      </div>
      <p className="flex items-start gap-1.5 text-[12.5px] text-brand-text/60">
        {busy ? <Loader2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 animate-spin" /> : <Eye aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />}
        {disabled ? "Save the section first to set where it appears." : "Visibility changes apply to the live website immediately."}
      </p>
    </div>
  );
}
