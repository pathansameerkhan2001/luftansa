"use client";

/**
 * Announcement Bar editor (Phase 3B, Checkpoint B).
 *
 * The whole bar (ordered messages + display mode) is one draft: adding,
 * editing, deleting and reordering messages change nothing on the website
 * until Publish. Validation uses the same schema as the server
 * (announcementPayloadSchema), so the inline messages match the server rules.
 */
import { ArrowDown, ArrowUp, CalendarClock, Megaphone, Monitor, Plus, Rows3, Smartphone, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  ANNOUNCEMENT_FALLBACK,
  ANNOUNCEMENT_HIGHLIGHT_MAX,
  ANNOUNCEMENT_MAX_MESSAGES,
  ANNOUNCEMENT_MODULE,
  announcementPayloadSchema,
  scheduleState,
  type AnnouncementDisplay,
  type AnnouncementPayload,
  type ScheduleState,
} from "@/lib/cms/modules/announcement-bar";
import { isoToLocalInput, localInputToIso } from "@/lib/cms/fields";
import { Card, TextField } from "@/components/admin/cms/FormFields";
import { PreviewFrame } from "@/components/admin/cms/PreviewFrame";
import { PublishBar, VisibilityControls } from "@/components/admin/cms/PublishBar";
import { useCmsSingleton, useUnsavedChangesWarning } from "@/components/admin/cms/useCmsEntry";
import { ADMIN_FOCUS, BTN_ICON, BTN_SECONDARY, ConfirmDialog, FeedbackBanner, FilterTabs, INPUT, PageIntro, Spinner, StatusBadge, useFeedback } from "@/components/admin/cms/ui";

/* ------------------------------------------------------------- form model --- */

interface MessageForm {
  id: string;
  highlight: string;
  ctaLabel: string;
  ctaHref: string;
  /** datetime-local value in the browser's time zone, "" when not set. */
  start: string;
  end: string;
  desktop: boolean;
  mobile: boolean;
}

interface BarForm {
  display: AnnouncementDisplay;
  messages: MessageForm[];
}

function newMessageId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
}

const blankMessage = (): MessageForm => ({ id: newMessageId(), highlight: "", ctaLabel: "", ctaHref: "", start: "", end: "", desktop: true, mobile: true });

function fromPayload(p: AnnouncementPayload): BarForm {
  return {
    display: p.display,
    messages: p.messages.map((m) => ({
      id: m.id,
      highlight: m.highlight,
      ctaLabel: m.cta?.label ?? "",
      ctaHref: m.cta?.href ?? "",
      start: isoToLocalInput(m.startAt),
      end: isoToLocalInput(m.endAt),
      desktop: m.desktop,
      mobile: m.mobile,
    })),
  };
}

/** Before anything is saved, the editor starts from the approved default message. */
const DEFAULT_FORM = fromPayload(ANNOUNCEMENT_FALLBACK);

function fromDraft(draft: Record<string, unknown> | undefined): BarForm {
  const parsed = announcementPayloadSchema.safeParse(draft);
  return parsed.success ? fromPayload(parsed.data) : DEFAULT_FORM;
}

function toDraft(f: BarForm) {
  return {
    display: f.display,
    messages: f.messages.map((m) => {
      const startAt = localInputToIso(m.start);
      const endAt = localInputToIso(m.end);
      return {
        id: m.id,
        highlight: m.highlight,
        cta: { label: m.ctaLabel, href: m.ctaHref },
        ...(startAt ? { startAt } : {}),
        ...(endAt ? { endAt } : {}),
        desktop: m.desktop,
        mobile: m.mobile,
      };
    }),
  };
}

type MessageField = "highlight" | "ctaLabel" | "ctaHref" | "start" | "end" | "devices";
type Errors = { bar?: string; messages: Record<string, Partial<Record<MessageField, string>>> };
const FIELD: Record<string, MessageField> = {
  highlight: "highlight",
  "cta.label": "ctaLabel",
  "cta.href": "ctaHref",
  cta: "ctaLabel",
  startAt: "start",
  endAt: "end",
  desktop: "devices",
};

function validate(f: BarForm): { ok: true; payload: AnnouncementPayload } | { ok: false; errors: Errors } {
  const parsed = announcementPayloadSchema.safeParse(toDraft(f));
  if (parsed.success) return { ok: true, payload: parsed.data };
  const errors: Errors = { messages: {} };
  for (const issue of parsed.error.issues) {
    const [root, index, ...rest] = issue.path;
    const msg = root === "messages" && typeof index === "number" ? f.messages[index] : undefined;
    const field = msg ? FIELD[rest.join(".")] : undefined;
    if (msg && field) {
      const bucket = (errors.messages[msg.id] ??= {});
      bucket[field] ??= issue.message;
    } else {
      errors.bar ??= issue.message;
    }
  }
  return { ok: false, errors };
}

/* ------------------------------------------------------------- presentation --- */

const dateTime = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function ScheduleBadge({ m, now }: { m: MessageForm; now: Date }) {
  const startAt = localInputToIso(m.start);
  const endAt = localInputToIso(m.end);
  const state: ScheduleState = scheduleState({ startAt, endAt }, now);
  if (state === "always") return <StatusBadge tone="neutral">Always on</StatusBadge>;
  if (state === "scheduled") return <StatusBadge tone="warning">Starts {dateTime.format(new Date(startAt!))}</StatusBadge>;
  if (state === "ended") return <StatusBadge tone="dark">Ended {dateTime.format(new Date(endAt!))}</StatusBadge>;
  return <StatusBadge tone="success">{endAt ? `Running until ${dateTime.format(new Date(endAt))}` : "Running"}</StatusBadge>;
}

function DateTimeField({ id, label, value, error, onChange }: { id: string; label: string; value: string; error?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="text-[13px] font-semibold text-brand-black">
        {label} <span className="font-normal text-brand-text/50">(optional)</span>
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id={id}
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${INPUT} h-10 min-w-0 flex-1 ${error ? "border-[#c97f70]" : ""}`}
        />
        {value ? (
          <button type="button" onClick={() => onChange("")} className={`${BTN_SECONDARY} shrink-0 px-3`} aria-label={`Clear ${label.toLowerCase()}`}>
            Clear
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-[12.5px] text-[#8a2f22]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function DeviceCheckbox({ id, label, checked, onChange, Icon }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void; Icon: typeof Monitor }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-[#e3d6bd] bg-white px-3 py-2.5 hover:border-brand-gold">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className={`size-4 accent-brand-black ${ADMIN_FOCUS}`} />
      <Icon aria-hidden="true" className="size-4 text-brand-text/60" strokeWidth={1.5} />
      <span className="text-[13.5px] text-brand-black">{label}</span>
    </label>
  );
}

/* ------------------------------------------------------------------ editor --- */

export function AnnouncementEditor() {
  const cms = useCmsSingleton(ANNOUNCEMENT_MODULE.id);
  const { feedback, setFeedback, clear } = useFeedback();
  const saved = useMemo(() => (cms.entry ? fromDraft(cms.entry.draft) : DEFAULT_FORM), [cms.entry]);
  const [edited, setEdited] = useState<{ base: BarForm; form: BarForm } | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [previewAt, setPreviewAt] = useState("");
  const [focusTarget, setFocusTarget] = useState<{ key: string; seq: number } | null>(null);
  const focus = (key: string) => setFocusTarget((prev) => ({ key, seq: (prev?.seq ?? 0) + 1 }));
  // "now" for the schedule badges, refreshed every minute.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Edits are kept against the saved version they started from; a new saved
  // version (after save/publish/reload) resets the form to it.
  const form = edited && edited.base === saved ? edited.form : saved;
  const setForm = (next: BarForm) => setEdited({ base: saved, form: next });
  const setMessage = (id: string, patch: Partial<MessageForm>) => setForm({ ...form, messages: form.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  useUnsavedChangesWarning(dirty);

  // Moves keyboard focus after reordering (the moved message's button, or its
  // card when that button is now disabled) and after adding (the new text field).
  useEffect(() => {
    if (!focusTarget) return;
    const [id, what] = focusTarget.key.split(":");
    const target =
      what === "text"
        ? document.getElementById(`msg-${id}-highlight`)
        : document.querySelector<HTMLButtonElement>(`[data-focus-key="${focusTarget.key}"]:not(:disabled)`) ?? document.querySelector<HTMLElement>(`[data-focus-key="${id}:card"]`);
    target?.focus();
  }, [focusTarget]);

  const check = validate(form);
  const errors: Errors = showErrors && !check.ok ? check.errors : { messages: {} };
  const runningNow = form.messages.filter((m) => {
    const s = scheduleState({ startAt: localInputToIso(m.start), endAt: localInputToIso(m.end) }, now);
    return s === "always" || s === "running";
  }).length;
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const move = (index: number, delta: -1 | 1) => {
    const to = index + delta;
    if (to < 0 || to >= form.messages.length) return;
    const messages = [...form.messages];
    const [m] = messages.splice(index, 1);
    messages.splice(to, 0, m);
    setForm({ ...form, messages });
    focus(`${m.id}:${delta < 0 ? "up" : "down"}`);
  };

  const add = () => {
    if (form.messages.length >= ANNOUNCEMENT_MAX_MESSAGES) return;
    const m = blankMessage();
    setForm({ ...form, messages: [...form.messages, m] });
    focus(`${m.id}:text`);
  };

  const attempt = async (action: "save" | "publish") => {
    clear();
    if (!check.ok) {
      setShowErrors(true);
      setFeedback({ tone: "error", message: "Please fix the highlighted fields." });
      return;
    }
    try {
      if (action === "save") {
        await cms.saveDraft(check.payload);
        setFeedback({ tone: "success", message: "Draft saved. The website is unchanged until you publish." });
      } else {
        await cms.publish(dirty || !cms.entry ? check.payload : undefined);
        setFeedback({ tone: "success", message: "Published. The announcement bar is updated on the website." });
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
        <PageIntro eyebrow="Website" title="Announcement Bar" />
        <Spinner label="Loading the announcement bar…" />
      </div>
    );
  }
  if (cms.loadError) {
    return (
      <div className="space-y-6">
        <PageIntro eyebrow="Website" title="Announcement Bar" />
        <FeedbackBanner feedback={{ tone: "error", message: cms.loadError }} onDismiss={() => void cms.reload()} />
      </div>
    );
  }

  const previewQuery = previewAt && localInputToIso(previewAt) ? `&at=${encodeURIComponent(localInputToIso(previewAt)!)}` : "";
  const removingMessage = form.messages.find((m) => m.id === removing);

  return (
    <div className="space-y-6" data-announcement-editor>
      <PageIntro
        eyebrow="Website"
        title="Announcement Bar"
        description="The thin black bar above the header on every page. Add, order and schedule messages, choose a scrolling or static display, preview, then publish."
      />

      <PublishBar
        entry={cms.entry}
        dirty={dirty}
        busy={cms.busy}
        sectionLabel="Announcement Bar"
        onSave={() => void attempt("save")}
        onPublish={() => void attempt("publish")}
        onUnpublish={() =>
          cms.unpublish().then(
            () => setFeedback({ tone: "success", message: "The announcement bar is now inactive and hidden on the website." }),
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
          The website currently shows the approved default message below. Edit it or add more, then publish to replace it.
        </p>
      ) : null}

      <Card
        icon={<Rows3 className="size-4.5" strokeWidth={1.5} />}
        title="Display"
        description={runningNow === 0 ? "No message is running right now, so the bar would be hidden." : `${form.messages.length} message${form.messages.length === 1 ? "" : "s"}, ${runningNow} running now.`}
      >
        <div>
          <FilterTabs
            label="Display mode"
            value={form.display}
            onChange={(display) => setForm({ ...form, display })}
            options={[
              { value: "ticker", label: "Ticker (scrolling)" },
              { value: "static", label: "Static" },
            ]}
          />
          <p className="mt-2 text-[12.5px] leading-snug text-brand-text/60" data-display-help>
            {form.display === "ticker"
              ? "Every running message scrolls past in order. Visitors can pause it; for visitors who prefer reduced motion it stands still."
              : "Shows one message, standing still: the first message in the list that is running now. When it ends, the next one takes over."}
          </p>
        </div>
      </Card>

      <div className="space-y-4" data-message-list>
        {form.messages.map((m, i) => {
          const e = errors.messages[m.id] ?? {};
          const n = i + 1;
          return (
            <section
              key={m.id}
              tabIndex={-1}
              data-focus-key={`${m.id}:card`}
              aria-labelledby={`msg-${m.id}-title`}
              className={`rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] outline-none sm:p-6 ${Object.keys(e).length ? "border-[#e2b4ab]" : "border-[#e3d6bd]"}`}
              data-message={m.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-brand-gold/30 bg-brand-cream text-brand-text/70">
                    <Megaphone aria-hidden="true" className="size-4.5" strokeWidth={1.5} />
                  </span>
                  <h2 id={`msg-${m.id}-title`} className="font-serif text-[21px] leading-tight font-semibold text-brand-black">
                    Message {n}
                  </h2>
                  <ScheduleBadge m={m} now={now} />
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} data-focus-key={`${m.id}:up`} className={`${BTN_ICON}`} aria-label={`Move message ${n} up`} title="Move up">
                    <ArrowUp aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === form.messages.length - 1}
                    data-focus-key={`${m.id}:down`}
                    className={`${BTN_ICON}`}
                    aria-label={`Move message ${n} down`}
                    title="Move down"
                  >
                    <ArrowDown aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemoving(m.id)}
                    disabled={form.messages.length === 1}
                    className={`${BTN_ICON} hover:border-[#9a3b2b] hover:text-[#9a3b2b]`}
                    aria-label={`Delete message ${n}`}
                    title={form.messages.length === 1 ? "The bar needs at least one message. Deactivate it to hide the bar." : "Delete"}
                    data-action="delete-message"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </div>
              </div>

              <div className="mt-5 space-y-5">
                <div>
                  <TextField
                    id={`msg-${m.id}-highlight`}
                    label="Highlight text"
                    required
                    value={m.highlight}
                    max={ANNOUNCEMENT_HIGHLIGHT_MAX}
                    error={e.highlight}
                    onChange={(highlight) => setMessage(m.id, { highlight })}
                    placeholder="For example: Signature Perfumes from ₹400"
                    help="Shown in bold. Use only confirmed facts: no ratings, review counts or unverified claims."
                  />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <TextField id={`msg-${m.id}-cta-label`} label="Button text" value={m.ctaLabel} max={40} error={e.ctaLabel} onChange={(ctaLabel) => setMessage(m.id, { ctaLabel })} help="Both button text and destination, or neither." />
                  <TextField
                    id={`msg-${m.id}-cta-href`}
                    label="Destination link"
                    value={m.ctaHref}
                    max={300}
                    error={e.ctaHref}
                    onChange={(ctaHref) => setMessage(m.id, { ctaHref })}
                    help="A page on this site starting with / (for example /#personality-collection), or a full https:// address (opens in a new tab)."
                  />
                </div>

                <fieldset>
                  <legend className="flex items-center gap-2 text-[13.5px] font-semibold text-brand-black">
                    <CalendarClock aria-hidden="true" className="size-4 text-brand-text/60" strokeWidth={1.5} /> Schedule
                  </legend>
                  <p className="mt-0.5 text-[12px] text-brand-text/55">Leave both empty to show the message whenever the bar is live. Times are in your computer&apos;s time zone ({timeZone}).</p>
                  <div className="mt-2.5 grid gap-4 sm:grid-cols-2">
                    <DateTimeField id={`msg-${m.id}-start`} label="Start" value={m.start} error={e.start} onChange={(start) => setMessage(m.id, { start })} />
                    <DateTimeField id={`msg-${m.id}-end`} label="End" value={m.end} error={e.end} onChange={(end) => setMessage(m.id, { end })} />
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-[13.5px] font-semibold text-brand-black">Show this message on</legend>
                  <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
                    <DeviceCheckbox id={`msg-${m.id}-desktop`} label="Tablets and desktops" Icon={Monitor} checked={m.desktop} onChange={(desktop) => setMessage(m.id, { desktop })} />
                    <DeviceCheckbox id={`msg-${m.id}-mobile`} label="Phones" Icon={Smartphone} checked={m.mobile} onChange={(mobile) => setMessage(m.id, { mobile })} />
                  </div>
                  {e.devices ? <p className="mt-1 text-[12.5px] text-[#8a2f22]">{e.devices}</p> : null}
                </fieldset>
              </div>
            </section>
          );
        })}

        {errors.bar ? <p className="text-[13px] text-[#8a2f22]">{errors.bar}</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={add} disabled={form.messages.length >= ANNOUNCEMENT_MAX_MESSAGES} className={BTN_SECONDARY} data-action="add-message">
            <Plus aria-hidden="true" className="size-4" /> Add message
          </button>
          <span className="text-[12.5px] text-brand-text/55">
            {form.messages.length} of {ANNOUNCEMENT_MAX_MESSAGES}. Adding, deleting and reordering only change the draft until you publish.
          </span>
        </div>
      </div>

      <section className="rounded-2xl border border-[#e3d6bd] bg-white p-4 sm:p-6" aria-labelledby="visibility-heading">
        <h2 id="visibility-heading" className="font-serif text-[21px] font-semibold text-brand-black">
          Visibility
        </h2>
        <p className="mt-1 text-[13px] text-brand-text/65">Shows or hides the whole bar per device. Use “Show this message on” above to target single messages.</p>
        <div className="mt-4">
          <VisibilityControls
            value={cms.entry?.visibility ?? { desktop: true, mobile: true }}
            disabled={!cms.entry}
            busy={cms.busy === "visibility"}
            onChange={(v) =>
              void cms.setVisibility(v).then(
                () => setFeedback({ tone: "success", message: "Visibility updated on the website." }),
                (e: Error) => setFeedback({ tone: "error", message: e.message }),
              )
            }
          />
        </div>
      </section>

      <section className="rounded-2xl border border-[#e3d6bd] bg-white p-4 sm:p-6" aria-labelledby="preview-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="preview-heading" className="font-serif text-[21px] font-semibold text-brand-black">
            Preview
          </h2>
          <div className="w-full sm:w-72">
            <DateTimeField id="preview-at" label="Preview as at" value={previewAt} onChange={setPreviewAt} />
          </div>
        </div>
        <div className="mt-4">
          <PreviewFrame
            title="Announcement Bar"
            draftSrc={`/admin/preview/announcement-bar?version=draft${previewQuery}`}
            liveSrc={`/admin/preview/announcement-bar?version=live${previewQuery}`}
            reloadKey={cms.entry ? `${cms.entry.version}` : "none"}
            frameHeight={420}
            note={
              dirty
                ? "The preview shows the last saved draft. Save to see your latest changes."
                : previewAt
                  ? "Showing the bar as it will look at the chosen date and time."
                  : "Exactly what the website will show now, at each device's real width. Choose a date to check a schedule."
            }
          />
        </div>
      </section>

      <ConfirmDialog
        open={removing !== null}
        title="Delete this message?"
        confirmLabel="Delete message"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) setForm({ ...form, messages: form.messages.filter((m) => m.id !== removing) });
          setRemoving(null);
        }}
      >
        {removingMessage?.highlight ? `“${removingMessage.highlight}” will be removed from the draft. ` : "This message will be removed from the draft. "}
        The website is unchanged until you publish, and Discard brings it back.
      </ConfirmDialog>
    </div>
  );
}
