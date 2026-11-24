"use client";

/**
 * Admin: one customer policy page (Shipping, Returns, Privacy or Terms) on the
 * existing CMS: save a draft, preview, publish, or deactivate (hides the page
 * and its footer link). Plain text only: a blank line starts a new paragraph,
 * lines starting with "- " become a bulleted list.
 */
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, ClipboardList, FileText, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Card, TextField } from "@/components/admin/cms/FormFields";
import { PreviewFrame } from "@/components/admin/cms/PreviewFrame";
import { PublishBar } from "@/components/admin/cms/PublishBar";
import { useCmsSingleton, useUnsavedChangesWarning } from "@/components/admin/cms/useCmsEntry";
import { BTN_ICON, BTN_SECONDARY, FeedbackBanner, INPUT, PageIntro, Spinner, useFeedback } from "@/components/admin/cms/ui";
import { POLICY_DEFAULTS, POLICY_DETAILS_NEEDED, POLICY_LABEL, POLICY_MODULES, POLICY_ROUTE, policyPayloadSchema, type PolicyKey } from "@/lib/cms/modules/policy-pages";

interface FormState {
  title: string;
  intro: string;
  lastUpdated: string;
  sections: { heading: string; body: string }[];
}

function toForm(raw: unknown, key: PolicyKey): FormState {
  const parsed = policyPayloadSchema.safeParse(raw);
  const p = parsed.success ? parsed.data : POLICY_DEFAULTS[key];
  return { title: p.title, intro: p.intro ?? "", lastUpdated: p.lastUpdated ?? "", sections: p.sections.map((s) => ({ ...s })) };
}

export function PolicyEditor({ policy }: { policy: PolicyKey }) {
  const mod = POLICY_MODULES[policy];
  const label = POLICY_LABEL[policy];
  const cms = useCmsSingleton(mod.id);
  const { feedback, setFeedback, clear } = useFeedback();
  const saved = useMemo(() => toForm(cms.entry?.draft ?? POLICY_DEFAULTS[policy], policy), [cms.entry, policy]);
  const [edited, setEdited] = useState<{ base: FormState; form: FormState } | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const form = edited && edited.base === saved ? edited.form : saved;
  const setForm = (next: FormState) => setEdited({ base: saved, form: next });
  const patch = (p: Partial<FormState>) => setForm({ ...form, ...p });
  const setSection = (i: number, p: Partial<FormState["sections"][number]>) => patch({ sections: form.sections.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const move = (i: number, d: -1 | 1) => {
    const next = [...form.sections];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    patch({ sections: next });
  };
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  useUnsavedChangesWarning(dirty);

  const parsed = policyPayloadSchema.safeParse(form);
  const errors: Record<string, string> = {};
  if (!parsed.success) for (const i of parsed.error.issues) errors[i.path.join(".")] ??= i.message;
  const err = (path: string) => (showErrors ? errors[path] : undefined);

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
        setFeedback({ tone: "success", message: `Draft saved. The ${label} page is unchanged until you publish.` });
      } else {
        await cms.publish(dirty || !cms.entry ? payload : undefined);
        setFeedback({ tone: "success", message: `Published. The ${label} page now shows this text.` });
      }
      setShowErrors(false);
      setEdited(null);
    } catch (e) {
      setFeedback({ tone: "error", message: (e as Error).message });
    }
  };

  const intro = (
    <PageIntro
      eyebrow="Website · Policy Pages"
      title={label}
      description={`The ${label} page (${POLICY_ROUTE[policy]}), linked from the footer. Save a draft, check the preview, then publish. Deactivate hides the page and its footer link.`}
      actions={
        <Link href="/admin/policies" className={BTN_SECONDARY}>
          <ArrowLeft className="size-4" /> All policy pages
        </Link>
      }
    />
  );

  if (cms.loading && !cms.entry) {
    return (
      <div className="space-y-6">
        {intro}
        <Spinner label="Loading the page…" />
      </div>
    );
  }
  if (cms.loadError) {
    return (
      <div className="space-y-6">
        {intro}
        <FeedbackBanner feedback={{ tone: "error", message: cms.loadError }} onDismiss={() => void cms.reload()} />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-policy-editor={policy}>
      {intro}

      <PublishBar
        entry={cms.entry}
        dirty={dirty}
        busy={cms.busy}
        sectionLabel={label}
        onSave={() => void attempt("save")}
        onPublish={() => void attempt("publish")}
        onUnpublish={() =>
          cms.unpublish().then(
            () => setFeedback({ tone: "success", message: `The ${label} page is now hidden, and its footer link removed.` }),
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

      <Card icon={<ClipboardList className="size-4.5" strokeWidth={1.5} />} title="Details only you can confirm" description="The default text states only what the website already says. Add these details (if they apply) before you publish.">
        <ul className="list-disc space-y-1 pl-5 text-[13.5px] text-brand-text/80">
          {POLICY_DETAILS_NEEDED[policy].map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </Card>

      <Card icon={<FileText className="size-4.5" strokeWidth={1.5} />} title="Page" description="Title, introduction and the date shown as “Last updated”.">
        <TextField id="policy-title" label="Title" value={form.title} max={80} required error={err("title")} onChange={(v) => patch({ title: v })} />
        <TextField id="policy-intro" label="Introduction" value={form.intro} max={600} multiline rows={2} error={err("intro")} onChange={(v) => patch({ intro: v })} help="One or two sentences under the title." />
        <div>
          <label htmlFor="policy-updated" className="text-[13.5px] font-semibold text-brand-black">
            Last updated <span className="font-normal text-brand-text/50">(optional)</span>
          </label>
          <input id="policy-updated" type="date" className={`${INPUT} mt-1.5 h-10 max-w-[220px]`} value={form.lastUpdated} onChange={(e) => patch({ lastUpdated: e.target.value })} aria-invalid={err("lastUpdated") ? true : undefined} />
          {err("lastUpdated") ? <p className="mt-1 text-[12.5px] text-[#8a2f22]">{err("lastUpdated")}</p> : null}
        </div>
      </Card>

      <Card
        icon={<FileText className="size-4.5" strokeWidth={1.5} />}
        title="Sections"
        description="Shown in this order. In the text, leave a blank line between paragraphs; start a line with “- ” for a bullet point."
        actions={
          <button type="button" className={BTN_SECONDARY} disabled={form.sections.length >= 20} onClick={() => patch({ sections: [...form.sections, { heading: "", body: "" }] })}>
            <Plus className="size-4" /> Add section
          </button>
        }
      >
        {err("sections") ? <p className="text-[12.5px] text-[#8a2f22]">{err("sections")}</p> : null}
        <ol className="space-y-4">
          {form.sections.map((s, i) => (
            <li key={i} className="rounded-xl border border-[#eee3cc] bg-[#fffdf8] p-3 sm:p-4" data-policy-section={i}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-semibold tracking-[0.08em] text-brand-text/60 uppercase">Section {i + 1}</span>
                <span className="flex gap-1.5">
                  <button type="button" className={BTN_ICON} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move section ${i + 1} up`}>
                    <ArrowUp className="size-4" />
                  </button>
                  <button type="button" className={BTN_ICON} disabled={i === form.sections.length - 1} onClick={() => move(i, 1)} aria-label={`Move section ${i + 1} down`}>
                    <ArrowDown className="size-4" />
                  </button>
                  <button type="button" className={BTN_ICON} disabled={form.sections.length <= 1} onClick={() => patch({ sections: form.sections.filter((_, j) => j !== i) })} aria-label={`Remove section ${i + 1}`}>
                    <Trash2 className="size-4" />
                  </button>
                </span>
              </div>
              <div className="space-y-4">
                <TextField id={`policy-s${i}-heading`} label="Heading" value={s.heading} max={120} required error={err(`sections.${i}.heading`)} onChange={(v) => setSection(i, { heading: v })} />
                <TextField id={`policy-s${i}-body`} label="Text" value={s.body} max={4000} required multiline rows={6} error={err(`sections.${i}.body`)} onChange={(v) => setSection(i, { body: v })} />
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <section className="rounded-2xl border border-[#e3d6bd] bg-white p-4 sm:p-6" aria-labelledby="policy-preview-heading">
        <h2 id="policy-preview-heading" className="font-serif text-[22px] font-semibold text-brand-black">
          Preview
        </h2>
        <div className="mt-4">
          <PreviewFrame
            title={label}
            draftSrc={`/admin/preview/policies/${policy}?version=draft`}
            liveSrc={`/admin/preview/policies/${policy}?version=live`}
            reloadKey={cms.entry ? `${cms.entry.version}` : "none"}
            frameHeight={760}
            note={dirty ? "The preview shows the last saved draft. Save to see your latest changes." : "The page as visitors see it, at each device's real width."}
          />
        </div>
      </section>
    </div>
  );
}
