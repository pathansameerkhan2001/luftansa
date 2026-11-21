"use client";

/**
 * Hero Section editor (Phase 3B, Checkpoint A).
 * Validation uses the same schema as the server (heroPayloadSchema), so the
 * messages shown here are exactly the rules the server enforces.
 */
import { Monitor, Smartphone, Type } from "lucide-react";
import { useMemo, useState } from "react";
import { CENTER_FOCAL, type FocalPoint } from "@/lib/cms/fields";
import { HERO_MODULE, heroPayloadSchema, type HeroPayload } from "@/lib/cms/modules/hero";
import { formatBytes } from "@/lib/media/client-upload";
import { FocalPointPicker, MediaField, useMediaLibrary } from "@/components/admin/cms/MediaPicker";
import { Card, TextField } from "@/components/admin/cms/FormFields";
import { PreviewFrame } from "@/components/admin/cms/PreviewFrame";
import { PublishBar, VisibilityControls } from "@/components/admin/cms/PublishBar";
import { useCmsSingleton, useUnsavedChangesWarning } from "@/components/admin/cms/useCmsEntry";
import { FeedbackBanner, INPUT, PageIntro, Spinner, useFeedback } from "@/components/admin/cms/ui";

interface HeroForm {
  desktopImageKey?: string;
  desktopAlt: string;
  desktopFocal: FocalPoint;
  desktopVideoKey?: string;
  mobileImageKey?: string;
  mobileAlt: string;
  mobileFocal: FocalPoint;
  mobileVideoKey?: string;
  heading: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
}

const EMPTY: HeroForm = {
  desktopAlt: "",
  desktopFocal: CENTER_FOCAL,
  mobileAlt: "",
  mobileFocal: CENTER_FOCAL,
  heading: "",
  subtitle: "",
  ctaLabel: "",
  ctaHref: "",
};

function fromDraft(draft: Record<string, unknown> | undefined): HeroForm {
  const parsed = heroPayloadSchema.safeParse(draft);
  if (!parsed.success) return EMPTY;
  const p = parsed.data;
  return {
    desktopImageKey: p.desktop.image.key,
    desktopAlt: p.desktop.image.alt,
    desktopFocal: p.desktop.focal,
    desktopVideoKey: p.desktop.video?.key,
    mobileImageKey: p.mobile.image?.key,
    mobileAlt: p.mobile.image?.alt ?? "",
    mobileFocal: p.mobile.focal,
    mobileVideoKey: p.mobile.video?.key,
    heading: p.heading ?? "",
    subtitle: p.subtitle ?? "",
    ctaLabel: p.cta?.label ?? "",
    ctaHref: p.cta?.href ?? "",
  };
}

function toDraft(f: HeroForm) {
  return {
    desktop: {
      image: { key: f.desktopImageKey ?? "", alt: f.desktopAlt },
      focal: f.desktopFocal,
      ...(f.desktopVideoKey ? { video: { key: f.desktopVideoKey } } : {}),
    },
    mobile: {
      ...(f.mobileImageKey ? { image: { key: f.mobileImageKey, alt: f.mobileAlt } } : {}),
      focal: f.mobileFocal,
      ...(f.mobileVideoKey ? { video: { key: f.mobileVideoKey } } : {}),
    },
    heading: f.heading,
    subtitle: f.subtitle,
    cta: { label: f.ctaLabel, href: f.ctaHref },
  };
}

type Errors = Partial<Record<"desktopImage" | "desktopAlt" | "desktopVideo" | "mobileImage" | "mobileAlt" | "mobileVideo" | "heading" | "subtitle" | "ctaLabel" | "ctaHref", string>>;
const PATHS: Record<string, keyof Errors> = {
  "desktop.image.key": "desktopImage",
  "desktop.image": "desktopImage",
  "desktop.image.alt": "desktopAlt",
  "desktop.video.key": "desktopVideo",
  "mobile.image.key": "mobileImage",
  "mobile.image.alt": "mobileAlt",
  "mobile.video.key": "mobileVideo",
  heading: "heading",
  subtitle: "subtitle",
  "cta.label": "ctaLabel",
  "cta.href": "ctaHref",
};

function validate(f: HeroForm): { ok: true; payload: HeroPayload } | { ok: false; errors: Errors } {
  const parsed = heroPayloadSchema.safeParse(toDraft(f));
  if (parsed.success) return { ok: true, payload: parsed.data };
  const errors: Errors = {};
  for (const issue of parsed.error.issues) {
    const field = PATHS[issue.path.join(".")];
    if (field && !errors[field]) errors[field] = issue.message;
  }
  if (Object.keys(errors).length === 0) errors.desktopImage = parsed.error.issues[0]?.message ?? "Check the highlighted fields";
  return { ok: false, errors };
}

function AltField({ id, value, error, onChange }: { id: string; value: string; error?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="text-[13px] font-semibold text-brand-black">
        Alt text <span className="text-[#8a2f22]">*</span>
      </label>
      <input
        id={id}
        type="text"
        value={value}
        maxLength={240}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
        placeholder="Describe what the image shows"
        className={`${INPUT} mt-1 ${error ? "border-[#c97f70]" : ""}`}
      />
      <p id={`${id}-help`} className="mt-1 text-[12px] text-brand-text/55">
        Read aloud by screen readers. Describe the image itself, without promotional claims.
      </p>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-[12.5px] text-[#8a2f22]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function HeroEditor() {
  const cms = useCmsSingleton(HERO_MODULE.id);
  const library = useMediaLibrary();
  const { feedback, setFeedback, clear } = useFeedback();
  const saved = useMemo(() => (cms.entry ? fromDraft(cms.entry.draft) : EMPTY), [cms.entry]);
  const [edited, setEdited] = useState<{ base: HeroForm; form: HeroForm } | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  // Edits are kept against the saved version they started from; a new saved
  // version (after save/publish/reload) resets the form to it.
  const form = edited && edited.base === saved ? edited.form : saved;
  const set = (patch: Partial<HeroForm>) => setEdited({ base: saved, form: { ...form, ...patch } });
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  useUnsavedChangesWarning(dirty);

  const check = validate(form);
  const errors: Errors = showErrors && !check.ok ? check.errors : {};
  const videoLimit = library.limits ? formatBytes(library.limits.videoBytes) : "4 MB";
  const desktopAsset = form.desktopImageKey ? library.byKey.get(form.desktopImageKey) : undefined;
  const mobileAsset = form.mobileImageKey ? library.byKey.get(form.mobileImageKey) : undefined;
  const mobileFocalSrc = (mobileAsset ?? desktopAsset)?.url;

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
        setFeedback({ tone: "success", message: "Published. The new hero is live on the website." });
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
        <PageIntro eyebrow="Website" title="Hero Section" />
        <Spinner label="Loading the hero…" />
      </div>
    );
  }
  if (cms.loadError) {
    return (
      <div className="space-y-6">
        <PageIntro eyebrow="Website" title="Hero Section" />
        <FeedbackBanner feedback={{ tone: "error", message: cms.loadError }} onDismiss={() => void cms.reload()} />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-hero-editor>
      <PageIntro
        eyebrow="Website"
        title="Hero Section"
        description="The full-width banner at the top of the homepage. Choose separate images (and optional videos) for desktops and phones, add an optional heading and button, preview, then publish."
      />

      <PublishBar
        entry={cms.entry}
        dirty={dirty}
        busy={cms.busy}
        sectionLabel="Hero Section"
        onSave={() => void attempt("save")}
        onPublish={() => void attempt("publish")}
        onUnpublish={() =>
          cms.unpublish().then(
            () => setFeedback({ tone: "success", message: "The hero is now inactive and hidden on the website." }),
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

      <Card icon={<Monitor className="size-4.5" strokeWidth={1.5} />} title="Desktop" description="Tablets and desktops (screens 640px and wider).">
        <MediaField
          id="desktop-image"
          label="Desktop hero image"
          kind="image"
          required
          folder="hero"
          library={library}
          value={form.desktopImageKey}
          error={errors.desktopImage}
          help="A wide landscape photo works best (for example 2400×1350 or larger). Also used on phones when no mobile image is set."
          onChange={(key, asset) => set({ desktopImageKey: key, ...(key && !form.desktopAlt && asset?.alt ? { desktopAlt: asset.alt } : {}), ...(key ? {} : { desktopAlt: "" }) })}
        >
          <AltField id="desktop-alt" value={form.desktopAlt} error={errors.desktopAlt} onChange={(desktopAlt) => set({ desktopAlt })} />
          {desktopAsset ? <FocalPointPicker id="desktop-focal" src={desktopAsset.url} label="Desktop focal point" value={form.desktopFocal} onChange={(desktopFocal) => set({ desktopFocal })} /> : null}
        </MediaField>
        <MediaField
          id="desktop-video"
          label="Desktop hero video"
          kind="video"
          folder="hero"
          library={library}
          value={form.desktopVideoKey}
          error={errors.desktopVideo}
          help={`Muted, loops and plays over the image (with a pause button). The image shows while it loads, if it fails, and for visitors who prefer reduced motion. MP4 or WebM up to ${videoLimit}.`}
          onChange={(desktopVideoKey) => set({ desktopVideoKey })}
        />
      </Card>

      <Card icon={<Smartphone className="size-4.5" strokeWidth={1.5} />} title="Mobile" description="Phones (screens narrower than 640px).">
        <MediaField
          id="mobile-image"
          label="Mobile hero image"
          kind="image"
          folder="hero"
          library={library}
          value={form.mobileImageKey}
          error={errors.mobileImage}
          help="A taller crop for phones. If empty, phones show the desktop image, cropped around the mobile focal point below."
          onChange={(key, asset) => set({ mobileImageKey: key, ...(key && !form.mobileAlt && asset?.alt ? { mobileAlt: asset.alt } : {}), ...(key ? {} : { mobileAlt: "" }) })}
        >
          <AltField id="mobile-alt" value={form.mobileAlt} error={errors.mobileAlt} onChange={(mobileAlt) => set({ mobileAlt })} />
        </MediaField>
        {mobileFocalSrc ? (
          <FocalPointPicker
            id="mobile-focal"
            src={mobileFocalSrc}
            label={mobileAsset ? "Mobile focal point" : "Mobile focal point (on the desktop image)"}
            value={form.mobileFocal}
            onChange={(mobileFocal) => set({ mobileFocal })}
          />
        ) : null}
        <MediaField
          id="mobile-video"
          label="Mobile hero video"
          kind="video"
          folder="hero"
          library={library}
          value={form.mobileVideoKey}
          error={errors.mobileVideo}
          help={`Phones never download the desktop video: without a mobile video they show the image only. A short, small file keeps the page fast. MP4 or WebM up to ${videoLimit}.`}
          onChange={(mobileVideoKey) => set({ mobileVideoKey })}
        />
      </Card>

      <Card icon={<Type className="size-4.5" strokeWidth={1.5} />} title="Text and button" description="All optional. Leave them empty for an image-only hero, as the website shows today.">
        <TextField id="hero-heading" label="Heading" value={form.heading} max={120} error={errors.heading} onChange={(heading) => set({ heading })} help="Shown as the page's main heading. Use only confirmed wording." />
        <TextField id="hero-subtitle" label="Subtitle" value={form.subtitle} max={240} error={errors.subtitle} multiline onChange={(subtitle) => set({ subtitle })} />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField id="hero-cta-label" label="Button label" value={form.ctaLabel} max={40} error={errors.ctaLabel} onChange={(ctaLabel) => set({ ctaLabel })} help="Both label and destination, or neither." />
          <TextField
            id="hero-cta-href"
            label="Button destination"
            value={form.ctaHref}
            max={300}
            error={errors.ctaHref}
            onChange={(ctaHref) => set({ ctaHref })}
            help="A page on this site starting with / (for example /#personality-collection), or a full https:// address (opens in a new tab)."
          />
        </div>
      </Card>

      <section className="rounded-2xl border border-[#e3d6bd] bg-white p-4 sm:p-6" aria-labelledby="visibility-heading">
        <h2 id="visibility-heading" className="font-serif text-[21px] font-semibold text-brand-black">
          Visibility
        </h2>
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
        <h2 id="preview-heading" className="font-serif text-[21px] font-semibold text-brand-black">
          Preview
        </h2>
        <div className="mt-4">
          <PreviewFrame
            title="Hero Section"
            draftSrc="/admin/preview/hero?version=draft"
            liveSrc="/admin/preview/hero?version=live"
            reloadKey={cms.entry ? `${cms.entry.version}` : "none"}
            note={dirty ? "The preview shows the last saved draft. Save to see your latest changes." : "Exactly what the website will show, at each device's real width."}
          />
        </div>
      </section>
    </div>
  );
}
