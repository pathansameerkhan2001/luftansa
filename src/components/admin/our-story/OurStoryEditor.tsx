"use client";

/**
 * Admin: the Our Story page (/our-story), on the existing CMS: save a draft,
 * preview, publish, or deactivate (the page then sends visitors to the
 * homepage brand story). Three sections, each with its own on/off switch;
 * images come from the Media Library (folder "about").
 */
import { ArrowDown, ArrowUp, BookOpenText, Milestone, Plus, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Card, TextField } from "@/components/admin/cms/FormFields";
import { FocalPointPicker, MediaField, useMediaLibrary, type MediaLibraryState } from "@/components/admin/cms/MediaPicker";
import { PreviewFrame } from "@/components/admin/cms/PreviewFrame";
import { PublishBar } from "@/components/admin/cms/PublishBar";
import { useCmsSingleton, useUnsavedChangesWarning } from "@/components/admin/cms/useCmsEntry";
import { BTN_ICON, BTN_SECONDARY, FeedbackBanner, PageIntro, Spinner, useFeedback } from "@/components/admin/cms/ui";
import { CENTER_FOCAL, type FocalPoint } from "@/lib/cms/fields";
import {
  MAX_BLOCK_POINTS,
  MAX_HEADLINE_LINES,
  MAX_JOURNEY_STEPS,
  MAX_STORY_BLOCKS,
  MIN_JOURNEY_STEPS,
  OUR_STORY_DEFAULT,
  OUR_STORY_MODULE,
  ourStoryPayloadSchema,
  type OurStoryPayload,
  type StoryImage,
} from "@/lib/cms/modules/our-story";

/* ------------------------------------------------------------- form state --- */

interface ImgForm {
  key: string;
  alt: string;
  focal: FocalPoint;
}
interface BlockForm {
  uid: string;
  heading: string;
  description: string;
  points: string;
}
interface StepForm {
  uid: string;
  image: ImgForm;
  period: string;
  title: string;
  description: string;
  caption: string;
}
interface Form {
  hero: { enabled: boolean; headline: string; supporting: string; image: ImgForm };
  why: { enabled: boolean; title: string; heading: string; image: ImgForm; blocks: BlockForm[]; closing: string; attribution: string };
  journey: { enabled: boolean; heading: string; subtitle: string; steps: StepForm[] };
}

let uidCounter = 0;
const uid = () => `u${++uidCounter}`;
const NO_IMAGE: ImgForm = { key: "", alt: "", focal: CENTER_FOCAL };
const imgForm = (i?: StoryImage): ImgForm => (i ? { key: i.key, alt: i.alt, focal: i.focal } : NO_IMAGE);
const imgPayload = (i: ImgForm) => (i.key ? { image: { key: i.key, alt: i.alt, focal: i.focal } } : {});
const emptyStep = (): StepForm => ({ uid: uid(), image: NO_IMAGE, period: "", title: "", description: "", caption: "" });
const emptyBlock = (): BlockForm => ({ uid: uid(), heading: "", description: "", points: "" });

function toForm(raw: unknown): Form {
  const parsed = ourStoryPayloadSchema.safeParse(raw);
  const p: OurStoryPayload = parsed.success ? parsed.data : OUR_STORY_DEFAULT;
  return {
    hero: { enabled: p.hero.enabled, headline: p.hero.headline, supporting: p.hero.supporting ?? "", image: imgForm(p.hero.image) },
    why: {
      enabled: p.why.enabled,
      title: p.why.title,
      heading: p.why.heading,
      image: imgForm(p.why.image),
      blocks: p.why.blocks.map((b) => ({ uid: uid(), heading: b.heading, description: b.description ?? "", points: b.points })),
      closing: p.why.closing ?? "",
      attribution: p.why.attribution ?? "",
    },
    journey: {
      enabled: p.journey.enabled,
      heading: p.journey.heading,
      subtitle: p.journey.subtitle ?? "",
      steps: p.journey.steps.map((s) => ({ uid: uid(), image: imgForm(s.image), period: s.period ?? "", title: s.title, description: s.description, caption: s.caption ?? "" })),
    },
  };
}

function toPayload(f: Form) {
  return {
    hero: { enabled: f.hero.enabled, headline: f.hero.headline, supporting: f.hero.supporting, ...imgPayload(f.hero.image) },
    why: {
      enabled: f.why.enabled,
      title: f.why.title,
      heading: f.why.heading,
      ...imgPayload(f.why.image),
      blocks: f.why.blocks.map(({ heading, description, points }) => ({ heading, description, points })),
      closing: f.why.closing,
      attribution: f.why.attribution,
    },
    journey: {
      enabled: f.journey.enabled,
      heading: f.journey.heading,
      subtitle: f.journey.subtitle,
      steps: f.journey.steps.map(({ image, period, title, description, caption }) => ({ ...imgPayload(image), period, title, description, caption })),
    },
  };
}

type Check = { ok: true; payload: Record<string, unknown> } | { ok: false; errors: Record<string, string> };

/** Same rules as the server. Errors keyed by path, e.g. "journey.steps.2.title". */
function validate(f: Form): Check {
  const parsed = ourStoryPayloadSchema.safeParse(toPayload(f));
  if (parsed.success) return { ok: true, payload: parsed.data as unknown as Record<string, unknown> };
  const errors: Record<string, string> = {};
  for (const i of parsed.error.issues) errors[i.path.join(".")] ??= i.message;
  return { ok: false, errors };
}

function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const next = [...list];
  [next[i], next[i + d]] = [next[i + d], next[i]];
  return next;
}

/* ------------------------------------------------------------ small parts --- */

function Toggle({ label, checked, onChange, field, help }: { label: string; checked: boolean; onChange: (v: boolean) => void; field: string; help?: string }) {
  return (
    <label className="flex items-start gap-2.5 text-[13.5px]">
      <input type="checkbox" className="mt-0.5 size-4 accent-[#161513]" checked={checked} onChange={(e) => onChange(e.target.checked)} data-field={field} />
      <span>
        <span className="font-semibold text-brand-black">{label}</span>
        {help ? <span className="mt-0.5 block text-[12px] text-brand-text/55">{help}</span> : null}
      </span>
    </label>
  );
}

function ImageField({ id, label, help, value, onChange, library, errors, path }: { id: string; label: string; help: ReactNode; value: ImgForm; onChange: (v: ImgForm) => void; library: MediaLibraryState; errors: Record<string, string>; path: string }) {
  const asset = value.key ? library.byKey.get(value.key) : undefined;
  return (
    <MediaField
      id={id}
      label={label}
      kind="image"
      folder="about"
      library={library}
      value={value.key || undefined}
      error={errors[`${path}.key`]}
      help={help}
      onChange={(key, a) => onChange(key ? { key, alt: value.alt || a?.alt || "", focal: value.key === key ? value.focal : CENTER_FOCAL } : NO_IMAGE)}
    >
      <TextField id={`${id}-alt`} label="Image description (alt text)" required value={value.alt} max={200} error={errors[`${path}.alt`]} onChange={(alt) => onChange({ ...value, alt })} help="Describe the image for visitors using screen readers." />
      {asset ? <FocalPointPicker id={`${id}-focal`} src={asset.url} label="Focal point (kept in view when the image is cropped)" value={value.focal} onChange={(focal) => onChange({ ...value, focal })} /> : null}
    </MediaField>
  );
}

function ListControls({ name, index, count, min, onMove, onRemove }: { name: string; index: number; count: number; min: number; onMove: (d: -1 | 1) => void; onRemove: () => void }) {
  return (
    <span className="flex gap-1.5">
      <button type="button" className={BTN_ICON} disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Move ${name} up`}>
        <ArrowUp className="size-4" />
      </button>
      <button type="button" className={BTN_ICON} disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`Move ${name} down`}>
        <ArrowDown className="size-4" />
      </button>
      <button type="button" className={BTN_ICON} disabled={count <= min} onClick={onRemove} aria-label={`Remove ${name}`} title={count <= min ? "At least one is required" : undefined}>
        <Trash2 className="size-4" />
      </button>
    </span>
  );
}

const SECTION_ERROR = (errors: Record<string, string>, prefix: string) => Object.keys(errors).some((k) => k.startsWith(prefix));

/* ------------------------------------------------------------------ editor --- */

export function OurStoryEditor() {
  const cms = useCmsSingleton(OUR_STORY_MODULE.id);
  const library = useMediaLibrary();
  const { feedback, setFeedback, clear } = useFeedback();
  const saved = useMemo(() => toForm(cms.entry?.draft ?? OUR_STORY_DEFAULT), [cms.entry]);
  const [edited, setEdited] = useState<{ base: Form; form: Form } | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const form = edited && edited.base === saved ? edited.form : saved;
  const set = (patch: Partial<Form>) => setEdited({ base: saved, form: { ...form, ...patch } });
  const setHero = (patch: Partial<Form["hero"]>) => set({ hero: { ...form.hero, ...patch } });
  const setWhy = (patch: Partial<Form["why"]>) => set({ why: { ...form.why, ...patch } });
  const setJourney = (patch: Partial<Form["journey"]>) => set({ journey: { ...form.journey, ...patch } });
  const dirty = JSON.stringify(toPayload(form)) !== JSON.stringify(toPayload(saved));
  useUnsavedChangesWarning(dirty);

  const check = validate(form);
  const errors = showErrors && !check.ok ? check.errors : {};

  const attempt = async (action: "save" | "publish") => {
    clear();
    if (!check.ok) {
      setShowErrors(true);
      const where = (["hero", "why", "journey"] as const).filter((s) => SECTION_ERROR(check.errors, `${s}.`));
      const names = { hero: "Brand statement", why: "Why We Started", journey: "Journey" };
      setFeedback({ tone: "error", message: `Please fix the highlighted fields${where.length ? ` (${where.map((w) => names[w]).join(", ")})` : ""}.` });
      return;
    }
    try {
      if (action === "save") {
        await cms.saveDraft(check.payload);
        setFeedback({ tone: "success", message: "Draft saved. The website is unchanged until you publish." });
      } else {
        await cms.publish(dirty || !cms.entry ? check.payload : undefined);
        setFeedback({ tone: "success", message: "Published. The Our Story page is updated on the website." });
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
        <PageIntro eyebrow="Website" title="Our Story" />
        <Spinner label="Loading the Our Story page…" />
      </div>
    );
  }
  if (cms.loadError) {
    return (
      <div className="space-y-6">
        <PageIntro eyebrow="Website" title="Our Story" />
        <FeedbackBanner feedback={{ tone: "error", message: cms.loadError }} onDismiss={() => void cms.reload()} />
      </div>
    );
  }

  const { hero, why, journey } = form;

  return (
    <div className="space-y-6" data-our-story-editor>
      <PageIntro
        eyebrow="Website"
        title="Our Story"
        description="The Our Story page (/our-story), linked from the header and footer: the brand statement, why we started, and the journey steps. Save a draft, check the preview, then publish. Deactivate hides the page; visitors are then sent to the brand story on the homepage."
      />

      <PublishBar
        entry={cms.entry}
        dirty={dirty}
        busy={cms.busy}
        sectionLabel="Our Story"
        onSave={() => void attempt("save")}
        onPublish={() => void attempt("publish")}
        onUnpublish={() =>
          cms.unpublish().then(
            () => setFeedback({ tone: "success", message: "The Our Story page is now hidden on the website." }),
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
      {library.error ? <FeedbackBanner feedback={{ tone: "error", message: `Media Library: ${library.error}` }} onDismiss={() => void library.reload()} /> : null}
      {!cms.entry ? (
        <p className="rounded-xl border border-[#e5c98f] bg-[#fdf4e2] px-4 py-3 text-[13.5px] text-[#7a5a2b]" data-default-note>
          The website currently shows the default Our Story content below (without images). Edit it, add your images, then publish.
        </p>
      ) : null}
      {!hero.enabled && !why.enabled && !journey.enabled ? (
        <p className="rounded-xl border border-[#e8c3bb] bg-[#fbeeeb] px-4 py-3 text-[13.5px] text-[#8a2f22]">Every section is switched off: visitors will be sent to the homepage brand story.</p>
      ) : null}

      {/* ------------------------------------------------------------ hero */}
      <Card icon={<Sparkles className="size-4.5" strokeWidth={1.5} />} title="1. Brand statement" description="The large statement at the top of the page, beside a story image.">
        <Toggle label="Show this section" checked={hero.enabled} onChange={(enabled) => setHero({ enabled })} field="hero-enabled" />
        <TextField
          id="hero-headline"
          label="Headline"
          required
          multiline
          rows={5}
          value={hero.headline}
          max={MAX_HEADLINE_LINES * 42}
          error={errors["hero.headline"]}
          onChange={(headline) => setHero({ headline })}
          help={`Each line is shown on its own row, in capitals (up to ${MAX_HEADLINE_LINES} lines of 40 characters).`}
        />
        <TextField id="hero-supporting" label="Supporting text" multiline rows={3} value={hero.supporting} max={400} error={errors["hero.supporting"]} onChange={(supporting) => setHero({ supporting })} help="Optional line under the headline." />
        <ImageField
          id="hero-image"
          label="Story image"
          help="Shown beside the statement (wide, for example 1600×1200 or larger). Without an image the statement is centred on its own."
          value={hero.image}
          onChange={(image) => setHero({ image })}
          library={library}
          errors={errors}
          path="hero.image"
        />
      </Card>

      {/* ------------------------------------------------------------- why */}
      <Card icon={<BookOpenText className="size-4.5" strokeWidth={1.5} />} title="2. Why We Started" description="Section title, a story or founder image, and the content blocks.">
        <Toggle label="Show this section" checked={why.enabled} onChange={(enabled) => setWhy({ enabled })} field="why-enabled" />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="why-title" label="Section title" required value={why.title} max={60} error={errors["why.title"]} onChange={(title) => setWhy({ title })} />
          <TextField id="why-heading" label="Intro heading" required value={why.heading} max={120} error={errors["why.heading"]} onChange={(heading) => setWhy({ heading })} />
        </div>
        <ImageField
          id="why-image"
          label="Founder or story image"
          help="Portrait image (4:5, for example 1200×1500). Without an image the text sits beside the title."
          value={why.image}
          onChange={(image) => setWhy({ image })}
          library={library}
          errors={errors}
          path="why.image"
        />

        <div>
          <p className="text-[13.5px] font-semibold text-brand-black">Content blocks</p>
          {errors["why.blocks"] ? <p className="mt-1 text-[12.5px] font-medium text-[#9a3b2b]">{errors["why.blocks"]}</p> : null}
          <ol className="mt-3 space-y-3">
            {why.blocks.map((b, i) => (
              <li key={b.uid} className="rounded-xl border border-[#eee3cc] bg-[#fffdf8] p-4" data-block-row={i + 1}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-brand-black">Block {i + 1}</span>
                  <ListControls
                    name={`block ${i + 1}`}
                    index={i}
                    count={why.blocks.length}
                    min={1}
                    onMove={(d) => setWhy({ blocks: move(why.blocks, i, d) })}
                    onRemove={() => setWhy({ blocks: why.blocks.filter((x) => x.uid !== b.uid) })}
                  />
                </div>
                <div className="space-y-3">
                  <TextField id={`block-${i}-heading`} label="Heading" required value={b.heading} max={80} error={errors[`why.blocks.${i}.heading`]} onChange={(heading) => setWhy({ blocks: why.blocks.map((x) => (x.uid === b.uid ? { ...x, heading } : x)) })} />
                  <TextField id={`block-${i}-description`} label="Description" multiline rows={2} value={b.description} max={400} error={errors[`why.blocks.${i}.description`]} onChange={(description) => setWhy({ blocks: why.blocks.map((x) => (x.uid === b.uid ? { ...x, description } : x)) })} />
                  <TextField
                    id={`block-${i}-points`}
                    label="Points"
                    multiline
                    rows={4}
                    value={b.points}
                    max={MAX_BLOCK_POINTS * 142}
                    error={errors[`why.blocks.${i}.points`]}
                    onChange={(points) => setWhy({ blocks: why.blocks.map((x) => (x.uid === b.uid ? { ...x, points } : x)) })}
                    help={`Optional. One point per line (up to ${MAX_BLOCK_POINTS}).`}
                  />
                </div>
              </li>
            ))}
          </ol>
          <button type="button" className={`${BTN_SECONDARY} mt-3`} disabled={why.blocks.length >= MAX_STORY_BLOCKS} onClick={() => setWhy({ blocks: [...why.blocks, emptyBlock()] })} data-action="add-block">
            <Plus className="size-4" /> Add block {why.blocks.length >= MAX_STORY_BLOCKS ? `(maximum ${MAX_STORY_BLOCKS})` : ""}
          </button>
        </div>

        <TextField id="why-closing" label="Closing text" multiline rows={3} value={why.closing} max={600} error={errors["why.closing"]} onChange={(closing) => setWhy({ closing })} help="Optional. Each line is shown on its own row." />
        <TextField id="why-attribution" label="Attribution" value={why.attribution} max={80} error={errors["why.attribution"]} onChange={(attribution) => setWhy({ attribution })} placeholder="e.g. Name, Founder" help="Optional. Shown as “— Name, Founder”. Leave empty to show no name." />
      </Card>

      {/* --------------------------------------------------------- journey */}
      <Card icon={<Milestone className="size-4.5" strokeWidth={1.5} />} title="3. Journey" description="Numbered process cards. Steps are numbered automatically in the order below.">
        <Toggle label="Show this section" checked={journey.enabled} onChange={(enabled) => setJourney({ enabled })} field="journey-enabled" />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="journey-heading" label="Section heading" required value={journey.heading} max={90} error={errors["journey.heading"]} onChange={(heading) => setJourney({ heading })} />
          <TextField id="journey-subtitle" label="Subtitle" value={journey.subtitle} max={200} error={errors["journey.subtitle"]} onChange={(subtitle) => setJourney({ subtitle })} help="Optional." />
        </div>
        {errors["journey.steps"] ? <p className="text-[12.5px] font-medium text-[#9a3b2b]">{errors["journey.steps"]}</p> : null}
        <ol className="space-y-3">
          {journey.steps.map((s, i) => {
            const setStep = (patch: Partial<StepForm>) => setJourney({ steps: journey.steps.map((x) => (x.uid === s.uid ? { ...x, ...patch } : x)) });
            const p = `journey.steps.${i}`;
            return (
              <li key={s.uid} className="rounded-xl border border-[#eee3cc] bg-[#fffdf8] p-4" data-step-row={i + 1}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-brand-black">
                    Step {i + 1}
                    {s.title ? <span className="font-normal text-brand-text/60"> · {s.title}</span> : null}
                  </span>
                  <ListControls
                    name={`step ${i + 1}`}
                    index={i}
                    count={journey.steps.length}
                    min={MIN_JOURNEY_STEPS}
                    onMove={(d) => setJourney({ steps: move(journey.steps, i, d) })}
                    onRemove={() => setJourney({ steps: journey.steps.filter((x) => x.uid !== s.uid) })}
                  />
                </div>
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField id={`step-${i}-title`} label="Title" required value={s.title} max={60} error={errors[`${p}.title`]} onChange={(title) => setStep({ title })} />
                    <TextField id={`step-${i}-period`} label="Date / period" value={s.period} max={40} error={errors[`${p}.period`]} onChange={(period) => setStep({ period })} help="Optional, e.g. a month range." />
                  </div>
                  <TextField id={`step-${i}-description`} label="Description" required multiline rows={3} value={s.description} max={300} error={errors[`${p}.description`]} onChange={(description) => setStep({ description })} />
                  <TextField id={`step-${i}-caption`} label="Caption" value={s.caption} max={120} error={errors[`${p}.caption`]} onChange={(caption) => setStep({ caption })} help="Optional small line at the bottom of the card." />
                  <ImageField
                    id={`step-${i}-image`}
                    label="Step image"
                    help="Square image (for example 1000×1000). Steps without an image show their number instead."
                    value={s.image}
                    onChange={(image) => setStep({ image })}
                    library={library}
                    errors={errors}
                    path={`${p}.image`}
                  />
                </div>
              </li>
            );
          })}
        </ol>
        <button type="button" className={BTN_SECONDARY} disabled={journey.steps.length >= MAX_JOURNEY_STEPS} onClick={() => setJourney({ steps: [...journey.steps, emptyStep()] })} data-action="add-step">
          <Plus className="size-4" /> Add step {journey.steps.length >= MAX_JOURNEY_STEPS ? `(maximum ${MAX_JOURNEY_STEPS})` : ""}
        </button>
      </Card>

      <section className="rounded-2xl border border-[#e3d6bd] bg-white p-4 sm:p-6" aria-labelledby="story-page-preview-heading">
        <h2 id="story-page-preview-heading" className="font-serif text-[22px] font-semibold text-brand-black">
          Preview
        </h2>
        <div className="mt-4">
          <PreviewFrame
            title="Our Story page"
            draftSrc="/admin/preview/our-story?version=draft"
            liveSrc="/admin/preview/our-story?version=live"
            reloadKey={cms.entry ? `${cms.entry.version}` : "none"}
            note={dirty ? "The preview shows the last saved draft. Save to see your latest changes." : "Exactly what the website will show, at each device's real width."}
          />
        </div>
      </section>
    </div>
  );
}
