"use client";

/**
 * Admin: homepage Brand Story ("Our Brand / The Luftansa Story"), on the
 * existing CMS: save a draft, preview, publish, or deactivate (removes the
 * section from the homepage). Same workflow as the Hero and Announcement Bar.
 */
import { BookOpen, ImageIcon, LayoutPanelLeft, MousePointerClick } from "lucide-react";
import { useMemo, useState } from "react";
import { Card, TextField } from "@/components/admin/cms/FormFields";
import { FocalPointPicker, MediaField, useMediaLibrary } from "@/components/admin/cms/MediaPicker";
import { PreviewFrame } from "@/components/admin/cms/PreviewFrame";
import { PublishBar } from "@/components/admin/cms/PublishBar";
import { useCmsSingleton, useUnsavedChangesWarning } from "@/components/admin/cms/useCmsEntry";
import { FeedbackBanner, FilterTabs, PageIntro, Spinner, useFeedback } from "@/components/admin/cms/ui";
import { CENTER_FOCAL, type FocalPoint } from "@/lib/cms/fields";
import { BRAND_STORY_DEFAULT, BRAND_STORY_MODULE, brandStoryPayloadSchema, type BrandStoryBackground, type BrandStoryPayload } from "@/lib/cms/modules/brand-story";

interface StoryForm {
  eyebrow: string;
  heading: string;
  description: string;
  ctaShow: boolean;
  ctaLabel: string;
  ctaHref: string;
  imageKey: string;
  imageAlt: string;
  focal: FocalPoint;
  imagePosition: "left" | "right";
  background: BrandStoryBackground;
}

function toForm(p: Partial<BrandStoryPayload>): StoryForm {
  const d = BRAND_STORY_DEFAULT;
  return {
    eyebrow: p.eyebrow ?? d.eyebrow,
    heading: p.heading ?? d.heading,
    description: p.description ?? d.description,
    ctaShow: p.cta?.show ?? d.cta.show,
    ctaLabel: p.cta?.label ?? d.cta.label,
    ctaHref: p.cta?.href ?? "",
    imageKey: p.image?.key ?? "",
    imageAlt: p.image?.alt ?? "",
    focal: p.image?.focal ?? CENTER_FOCAL,
    imagePosition: p.layout?.imagePosition ?? "left",
    background: p.layout?.background ?? "ivory",
  };
}

function toPayload(f: StoryForm) {
  return {
    eyebrow: f.eyebrow,
    heading: f.heading,
    description: f.description,
    cta: { show: f.ctaShow, label: f.ctaLabel, href: f.ctaHref },
    ...(f.imageKey ? { image: { key: f.imageKey, alt: f.imageAlt, focal: f.focal } } : {}),
    layout: { imagePosition: f.imagePosition, background: f.background },
  };
}

type Check = { ok: true; payload: Record<string, unknown> } | { ok: false; errors: Record<string, string> };

/** Same rules as the server. Errors keyed by form field. */
function validate(f: StoryForm): Check {
  const parsed = brandStoryPayloadSchema.safeParse(toPayload(f));
  if (parsed.success) return { ok: true, payload: parsed.data as unknown as Record<string, unknown> };
  const map: Record<string, string> = { "cta.label": "ctaLabel", "cta.href": "ctaHref", "image.key": "image", "image.alt": "imageAlt" };
  const errors: Record<string, string> = {};
  for (const i of parsed.error.issues) {
    const k = map[i.path.join(".")] ?? String(i.path[0]);
    errors[k] ??= i.message;
  }
  return { ok: false, errors };
}

export function BrandStoryEditor() {
  const cms = useCmsSingleton(BRAND_STORY_MODULE.id);
  const library = useMediaLibrary();
  const { feedback, setFeedback, clear } = useFeedback();
  const saved = useMemo(() => toForm((cms.entry?.draft ?? BRAND_STORY_DEFAULT) as Partial<BrandStoryPayload>), [cms.entry]);
  const [edited, setEdited] = useState<{ base: StoryForm; form: StoryForm } | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const form = edited && edited.base === saved ? edited.form : saved;
  const set = (patch: Partial<StoryForm>) => setEdited({ base: saved, form: { ...form, ...patch } });
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  useUnsavedChangesWarning(dirty);

  const check = validate(form);
  const errors = showErrors && !check.ok ? check.errors : {};
  const asset = form.imageKey ? library.byKey.get(form.imageKey) : undefined;

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
        setFeedback({ tone: "success", message: "Published. The Brand Story is updated on the website." });
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
        <PageIntro eyebrow="Website" title="Brand Story" />
        <Spinner label="Loading the Brand Story…" />
      </div>
    );
  }
  if (cms.loadError) {
    return (
      <div className="space-y-6">
        <PageIntro eyebrow="Website" title="Brand Story" />
        <FeedbackBanner feedback={{ tone: "error", message: cms.loadError }} onDismiss={() => void cms.reload()} />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-brand-story-editor>
      <PageIntro
        eyebrow="Website"
        title="Brand Story"
        description="The “Our Brand / The Luftansa Story” section of the homepage: image, story text and button. Save a draft, check the preview, then publish. Deactivate removes the section from the homepage."
      />

      <PublishBar
        entry={cms.entry}
        dirty={dirty}
        busy={cms.busy}
        sectionLabel="Brand Story"
        onSave={() => void attempt("save")}
        onPublish={() => void attempt("publish")}
        onUnpublish={() =>
          cms.unpublish().then(
            () => setFeedback({ tone: "success", message: "The Brand Story is now hidden on the website." }),
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
          The website currently shows the default Brand Story below. Edit it, then publish to replace it.
        </p>
      ) : null}

      <Card icon={<BookOpen className="size-4.5" strokeWidth={1.5} />} title="Story" description="Text on the story side of the section.">
        <div className="space-y-4">
          <TextField id="story-eyebrow" label="Eyebrow label" required value={form.eyebrow} max={40} error={errors.eyebrow} onChange={(eyebrow) => set({ eyebrow })} help="The small line above the heading, e.g. OUR BRAND." />
          <TextField id="story-heading" label="Heading" required value={form.heading} max={80} error={errors.heading} onChange={(heading) => set({ heading })} />
          <TextField
            id="story-description"
            label="Description"
            required
            multiline
            rows={7}
            value={form.description}
            max={900}
            error={errors.description}
            onChange={(description) => set({ description })}
            help="Leave an empty line between paragraphs."
          />
        </div>
      </Card>

      <Card icon={<MousePointerClick className="size-4.5" strokeWidth={1.5} />} title="Button" description="The underlined link under the story.">
        <label className="flex items-center gap-2.5 text-[13.5px] font-semibold">
          <input type="checkbox" className="size-4 accent-[#161513]" checked={form.ctaShow} onChange={(e) => set({ ctaShow: e.target.checked })} data-field="cta-show" />
          Show the button
        </label>
        {form.ctaShow ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField id="story-cta-label" label="Button label" required value={form.ctaLabel} max={40} error={errors.ctaLabel} onChange={(ctaLabel) => set({ ctaLabel })} />
            <TextField
              id="story-cta-href"
              label="Button destination"
              value={form.ctaHref}
              max={300}
              error={errors.ctaHref}
              onChange={(ctaHref) => set({ ctaHref })}
              placeholder="/#personality-collection"
              help="A page on this site starting with /, or a full https:// address (opens in a new tab). Empty: the label is shown without a link."
            />
          </div>
        ) : null}
      </Card>

      <Card icon={<ImageIcon className="size-4.5" strokeWidth={1.5} />} title="Image" description="Large portrait image beside the story (4:5, for example 1200×1500). Without an image the section shows an empty ivory frame.">
        <MediaField
          id="story-image"
          label="Brand Story image"
          kind="image"
          folder="about"
          library={library}
          value={form.imageKey || undefined}
          error={errors.image}
          help="Upload a new image or choose one from the Media Library. Replacing or removing it never deletes the file from the Media Library."
          onChange={(key, a) => set({ imageKey: key ?? "", ...(key ? (!form.imageAlt && a?.alt ? { imageAlt: a.alt } : {}) : { imageAlt: "", focal: CENTER_FOCAL }) })}
        >
          <TextField id="story-image-alt" label="Image description (alt text)" required value={form.imageAlt} max={200} error={errors.imageAlt} onChange={(imageAlt) => set({ imageAlt })} help="Describe the image for visitors using screen readers." />
          {asset ? <FocalPointPicker id="story-focal" src={asset.url} label="Focal point (kept in view when the image is cropped)" value={form.focal} onChange={(focal) => set({ focal })} /> : null}
        </MediaField>
      </Card>

      <Card icon={<LayoutPanelLeft className="size-4.5" strokeWidth={1.5} />} title="Layout">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[13.5px] font-semibold text-brand-black">Image position on desktop</p>
            <FilterTabs
              label="Image position"
              value={form.imagePosition}
              onChange={(imagePosition) => set({ imagePosition })}
              options={[
                { value: "left", label: "Image left" },
                { value: "right", label: "Image right" },
              ]}
            />
            <p className="mt-1.5 text-[12px] text-brand-text/55">On phones the image is always above the story.</p>
          </div>
          <div>
            <p className="mb-2 text-[13.5px] font-semibold text-brand-black">Background</p>
            <FilterTabs
              label="Background"
              value={form.background}
              onChange={(background) => set({ background })}
              options={[
                { value: "ivory", label: "Ivory" },
                { value: "cream", label: "Cream" },
                { value: "white", label: "White" },
              ]}
            />
          </div>
        </div>
      </Card>

      <section className="rounded-2xl border border-[#e3d6bd] bg-white p-4 sm:p-6" aria-labelledby="story-preview-heading">
        <h2 id="story-preview-heading" className="font-serif text-[22px] font-semibold text-brand-black">Preview</h2>
        <div className="mt-4">
          <PreviewFrame
            title="Brand Story"
            draftSrc="/admin/preview/brand-story?version=draft"
            liveSrc="/admin/preview/brand-story?version=live"
            reloadKey={cms.entry ? `${cms.entry.version}` : "none"}
            frameHeight={1100}
            note={dirty ? "The preview shows the last saved draft. Save to see your latest changes." : "Exactly what the website will show, at each device's real width."}
          />
        </div>
      </section>
    </div>
  );
}
