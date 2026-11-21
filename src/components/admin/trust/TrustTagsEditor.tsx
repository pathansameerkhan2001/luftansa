"use client";

/**
 * Admin: global trust tags on every product page (DETAILS section), on the
 * existing CMS: save a draft, preview, publish, or deactivate (hides every
 * tag). Labels, order and on/off per tag; the icons belong to each tag.
 */
import { ArrowDown, ArrowUp, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Card } from "@/components/admin/cms/FormFields";
import { PreviewFrame } from "@/components/admin/cms/PreviewFrame";
import { PublishBar } from "@/components/admin/cms/PublishBar";
import { useCmsSingleton, useUnsavedChangesWarning } from "@/components/admin/cms/useCmsEntry";
import { BTN_ICON, FeedbackBanner, INPUT, PageIntro, Spinner, useFeedback } from "@/components/admin/cms/ui";
import { TRUST_TAG_PURPOSE, TRUST_TAGS_DEFAULT, TRUST_TAGS_MODULE, trustTagsPayloadSchema, type TrustTag } from "@/lib/cms/modules/trust-tags";

function toTags(raw: unknown): TrustTag[] {
  const parsed = trustTagsPayloadSchema.safeParse(raw);
  return (parsed.success ? parsed.data : TRUST_TAGS_DEFAULT).tags;
}

export function TrustTagsEditor() {
  const cms = useCmsSingleton(TRUST_TAGS_MODULE.id);
  const { feedback, setFeedback, clear } = useFeedback();
  const saved = useMemo(() => toTags(cms.entry?.draft ?? TRUST_TAGS_DEFAULT), [cms.entry]);
  const [edited, setEdited] = useState<{ base: TrustTag[]; tags: TrustTag[] } | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const tags = edited && edited.base === saved ? edited.tags : saved;
  const setTags = (next: TrustTag[]) => setEdited({ base: saved, tags: next });
  const update = (i: number, patch: Partial<TrustTag>) => setTags(tags.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...tags];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setTags(next);
  };
  const dirty = JSON.stringify(tags) !== JSON.stringify(saved);
  useUnsavedChangesWarning(dirty);

  const parsed = trustTagsPayloadSchema.safeParse({ tags });
  const errors: Record<number, string> = {};
  if (!parsed.success) for (const i of parsed.error.issues) if (typeof i.path[1] === "number") errors[i.path[1]] ??= i.message;

  const attempt = async (action: "save" | "publish") => {
    clear();
    if (!parsed.success) {
      setShowErrors(true);
      setFeedback({ tone: "error", message: "Please fix the highlighted fields." });
      return;
    }
    const payload = parsed.data as unknown as Record<string, unknown>;
    try {
      if (action === "save") {
        await cms.saveDraft(payload);
        setFeedback({ tone: "success", message: "Draft saved. Product pages are unchanged until you publish." });
      } else {
        await cms.publish(dirty || !cms.entry ? payload : undefined);
        setFeedback({ tone: "success", message: "Published. Every product page shows these trust tags." });
      }
      setShowErrors(false);
      setEdited(null);
    } catch (e) {
      setFeedback({ tone: "error", message: (e as Error).message });
    }
  };

  if (cms.loading && !cms.entry) {
    return (
      <div className="space-y-6">
        <PageIntro eyebrow="Website" title="Product Trust Tags" />
        <Spinner label="Loading the trust tags…" />
      </div>
    );
  }
  if (cms.loadError) {
    return (
      <div className="space-y-6">
        <PageIntro eyebrow="Website" title="Product Trust Tags" />
        <FeedbackBanner feedback={{ tone: "error", message: cms.loadError }} onDismiss={() => void cms.reload()} />
      </div>
    );
  }

  const shown = tags.filter((t) => t.enabled).length;

  return (
    <div className="space-y-6" data-trust-tags-editor>
      <PageIntro
        eyebrow="Website"
        title="Product Trust Tags"
        description="The quality tags in the DETAILS section of every product page, Perfumes and Roll-Ons alike. They apply to every product automatically, including new and imported ones. Save a draft, check the preview, then publish. Deactivate hides all of them."
      />

      <PublishBar
        entry={cms.entry}
        dirty={dirty}
        busy={cms.busy}
        sectionLabel="Product Trust Tags"
        onSave={() => void attempt("save")}
        onPublish={() => void attempt("publish")}
        onUnpublish={() =>
          cms.unpublish().then(
            () => setFeedback({ tone: "success", message: "The trust tags are now hidden on every product page." }),
            (e: Error) => setFeedback({ tone: "error", message: e.message }),
          )
        }
        onDiscard={() => {
          setEdited(null);
          setShowErrors(false);
          clear();
        }}
      />

      <FeedbackBanner feedback={feedback} onDismiss={clear} />
      {!cms.entry ? (
        <p className="rounded-xl border border-[#e5c98f] bg-[#fdf4e2] px-4 py-3 text-[13.5px] text-[#7a5a2b]" data-default-note>
          Product pages currently show the five default tags below. Edit them, then publish to replace them.
        </p>
      ) : null}

      <Card icon={<ShieldCheck className="size-4.5" strokeWidth={1.5} />} title="Tags" description={`Shown in this order. ${shown} of ${tags.length} shown.`}>
        <ol className="space-y-2">
          {tags.map((t, i) => {
            const error = showErrors ? errors[i] : undefined;
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#eee3cc] bg-[#fffdf8] px-3 py-2.5" data-tag-row={t.id}>
                <span className="w-5 text-right text-[13px] text-brand-text/45 tabular-nums">{i + 1}</span>
                <label className="flex items-center gap-2 text-[13px] font-medium">
                  <input type="checkbox" className="size-4 accent-[#161513]" checked={t.enabled} onChange={(e) => update(i, { enabled: e.target.checked })} data-field={`${t.id}-enabled`} />
                  Show
                </label>
                <span className="min-w-[200px] flex-1">
                  <label htmlFor={`tag-${t.id}`} className="sr-only">
                    Label: {TRUST_TAG_PURPOSE[t.id]}
                  </label>
                  <input
                    id={`tag-${t.id}`}
                    className={`${INPUT} h-10 ${error ? "border-[#9a3b2b]" : ""}`}
                    value={t.label}
                    maxLength={60}
                    onChange={(e) => update(i, { label: e.target.value })}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={`tag-${t.id}-help`}
                    data-field={`${t.id}-label`}
                  />
                  <span id={`tag-${t.id}-help`} className={`mt-1 block text-[12px] ${error ? "font-medium text-[#9a3b2b]" : "text-brand-text/55"}`}>
                    {error ?? TRUST_TAG_PURPOSE[t.id]}
                  </span>
                </span>
                <span className="flex gap-1.5">
                  <button type="button" className={BTN_ICON} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${t.label || t.id} up`}>
                    <ArrowUp className="size-4" />
                  </button>
                  <button type="button" className={BTN_ICON} disabled={i === tags.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${t.label || t.id} down`}>
                    <ArrowDown className="size-4" />
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="text-[12.5px] text-brand-text/60">Only publish promises that are true for every product.</p>
      </Card>

      <section className="rounded-2xl border border-[#e3d6bd] bg-white p-4 sm:p-6" aria-labelledby="trust-preview-heading">
        <h2 id="trust-preview-heading" className="font-serif text-[22px] font-semibold text-brand-black">
          Preview
        </h2>
        <div className="mt-4">
          <PreviewFrame
            title="Product Trust Tags"
            draftSrc="/admin/preview/trust-tags?version=draft"
            liveSrc="/admin/preview/trust-tags?version=live"
            reloadKey={cms.entry ? `${cms.entry.version}` : "none"}
            frameHeight={520}
            note={dirty ? "The preview shows the last saved draft. Save to see your latest changes." : "The DETAILS section as product pages show it, at each device's real width."}
          />
        </div>
      </section>
    </div>
  );
}
