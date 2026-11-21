/**
 * Brand Story CMS module ("Our Brand / The Luftansa Story" homepage section),
 * a single record on the existing CMS.
 *
 *   - Never published  → the approved default content (today's section).
 *   - Published        → the CMS content.
 *   - Deactivated      → the section is removed from the homepage.
 *
 * The image is a Media Library key, so the Media Library's "where used" check
 * protects it from deletion. Without an image the section keeps its ivory frame.
 */
import { z } from "zod";
import type { CmsModuleDefinition } from "../schemas";
import { CENTER_FOCAL, focalPointSchema, isSafeHref, mediaKeySchema, type FocalPoint } from "../fields";

export const BRAND_STORY_BACKGROUNDS = ["ivory", "cream", "white"] as const;
export type BrandStoryBackground = (typeof BRAND_STORY_BACKGROUNDS)[number];

const text = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `Enter the ${label.toLowerCase()}`).max(max, `${label} must be ${max} characters or fewer`);

export const brandStoryPayloadSchema = z
  .object({
    eyebrow: text(1, 40, "Eyebrow label"),
    heading: text(1, 80, "Heading"),
    description: text(1, 900, "Description"),
    cta: z
      .object({
        show: z.boolean(),
        label: text(1, 40, "Button label"),
        /** Empty: the label is shown without a link (e.g. until an About page exists). */
        href: z.preprocess(
          (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
          z.string().trim().max(300).refine(isSafeHref, "Use a site path such as /#collection, or a full https:// address").optional(),
        ),
      })
      .strict(),
    image: z
      .object({
        key: mediaKeySchema("image"),
        alt: z.string().trim().min(1, "Describe the image for screen readers").max(200, "Alt text must be 200 characters or fewer"),
        focal: focalPointSchema.default(CENTER_FOCAL),
      })
      .strict()
      .optional(),
    layout: z
      .object({
        imagePosition: z.enum(["left", "right"]).default("left"),
        background: z.enum(BRAND_STORY_BACKGROUNDS).default("ivory"),
      })
      .strict()
      .default({ imagePosition: "left", background: "ivory" }),
  })
  .strict();
export type BrandStoryPayload = z.infer<typeof brandStoryPayloadSchema>;
export type BrandStoryPayloadInput = z.input<typeof brandStoryPayloadSchema>;

export const BRAND_STORY_MODULE = {
  id: "brand-story",
  label: "Brand Story",
  kind: "singleton",
  payload: brandStoryPayloadSchema as unknown as z.ZodType<Record<string, unknown>>,
} as const satisfies CmsModuleDefinition;

/** Today's section content: shown until the admin publishes their own. */
export const BRAND_STORY_DEFAULT: BrandStoryPayload = {
  eyebrow: "Our Brand",
  heading: "The Luftansa Story",
  description:
    "At Luftansa Fragrance Craft Hub, we believe every fragrance tells a story. Our collection brings together distinctive scents, thoughtful craftsmanship and memorable fragrance experiences, created for every mood, moment and personality.",
  cta: { show: true, label: "Discover Our Story" },
  layout: { imagePosition: "left", background: "ivory" },
};

/* ------------------------------------------------------------ rendering --- */

export interface BrandStoryView {
  eyebrow: string;
  heading: string;
  /** Paragraphs (blank lines in the description start a new paragraph). */
  paragraphs: string[];
  cta?: { label: string; href?: string };
  image?: { src: string; alt: string; position: string };
  imagePosition: "left" | "right";
  background: BrandStoryBackground;
}

const objectPosition = (f: FocalPoint) => `${f.x}% ${f.y}%`;

/** View of a payload (pure). `toUrl` resolves a Media Library key. */
export function toBrandStoryView(p: BrandStoryPayload, toUrl: (key: string) => string): BrandStoryView {
  return {
    eyebrow: p.eyebrow,
    heading: p.heading,
    paragraphs: p.description.split(/\n\s*\n/).map((s) => s.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean),
    cta: p.cta.show ? { label: p.cta.label, href: p.cta.href } : undefined,
    image: p.image ? { src: toUrl(p.image.key), alt: p.image.alt, position: objectPosition(p.image.focal) } : undefined,
    imagePosition: p.layout.imagePosition,
    background: p.layout.background,
  };
}

/**
 * What the homepage shows (pure). null = section removed (deactivated).
 * The default content is used until something is published, while the
 * database is unavailable, and if stored content is no longer valid
 * (the site stays whole).
 */
export function resolveBrandStory(result: { source: "cms" | "fallback"; items: readonly { payload: unknown }[] }, toUrl: (key: string) => string): BrandStoryView | null {
  if (result.source === "cms" && result.items.length === 0) return null;
  const parsed = brandStoryPayloadSchema.safeParse(result.items[0]?.payload);
  return toBrandStoryView(parsed.success ? parsed.data : BRAND_STORY_DEFAULT, toUrl);
}
