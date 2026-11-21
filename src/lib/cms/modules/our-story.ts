/**
 * Our Story page (/our-story) CMS module: a single record on the existing CMS
 * with three sections, each with its own on/off switch.
 *
 *   hero     large brand statement (one line per row) beside a story image
 *   why      "Why We Started": story image, intro heading, content blocks
 *            (description + optional points), optional closing and attribution
 *   journey  numbered process cards (image, optional period, title,
 *            description, optional caption); steps are numbered automatically
 *
 *   - Never published  → the default content below (no images, no figures).
 *   - Published        → the CMS content.
 *   - Deactivated      → the page sends visitors to the homepage brand story.
 *
 * Images are Media Library keys (folder "about"), so the Media Library's
 * "where used" check protects them. Every image is optional: each layout
 * adapts when there is none (no empty frames or "coming soon" boxes).
 * Default copy contains no statistics, dates, certifications or test claims.
 */
import { z } from "zod";
import type { CmsModuleDefinition } from "../schemas";
import { CENTER_FOCAL, focalPointSchema, mediaKeySchema, type FocalPoint } from "../fields";

export const MAX_HEADLINE_LINES = 6;
export const MAX_STORY_BLOCKS = 4;
export const MAX_BLOCK_POINTS = 8;
export const MAX_JOURNEY_STEPS = 8;
export const MIN_JOURNEY_STEPS = 1;

const text = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `Enter the ${label.toLowerCase()}`).max(max, `${label} must be ${max} characters or fewer`);
const optionalText = (max: number, label: string) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max, `${label} must be ${max} characters or fewer`).optional());

/** Optional image: a Media Library key, its alt text and focal point. */
const imageSchema = z
  .object({
    key: mediaKeySchema("image"),
    alt: z.string().trim().min(1, "Describe the image for screen readers").max(200, "Alt text must be 200 characters or fewer"),
    focal: focalPointSchema.default(CENTER_FOCAL),
  })
  .strict();
export type StoryImage = z.infer<typeof imageSchema>;

/** Lines of text entered one per line: blank lines are ignored. */
const linesSchema = (maxLines: number, maxLength: number, label: string) =>
  z
    .string()
    .max(maxLines * (maxLength + 2), `${label} is too long`)
    .refine((v) => splitLines(v).length <= maxLines, `${label}: at most ${maxLines} lines`)
    .refine((v) => splitLines(v).every((l) => l.length <= maxLength), `${label}: each line must be ${maxLength} characters or fewer`);

export function splitLines(v: string | undefined): string[] {
  return (v ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export const storyBlockSchema = z
  .object({
    heading: text(1, 80, "Block heading"),
    description: optionalText(400, "Block description"),
    /** Optional points, one per line. */
    points: z.preprocess((v) => (v === undefined ? "" : v), linesSchema(MAX_BLOCK_POINTS, 140, "Points")),
  })
  .strict()
  .refine((b) => Boolean(b.description) || splitLines(b.points).length > 0, { message: "Add a description or at least one point", path: ["description"] });
export type StoryBlock = z.infer<typeof storyBlockSchema>;

export const journeyStepSchema = z
  .object({
    image: imageSchema.optional(),
    period: optionalText(40, "Date / period"),
    title: text(1, 60, "Step title"),
    description: text(1, 300, "Step description"),
    caption: optionalText(120, "Caption"),
  })
  .strict();
export type JourneyStep = z.infer<typeof journeyStepSchema>;

export const ourStoryPayloadSchema = z
  .object({
    hero: z
      .object({
        enabled: z.boolean(),
        /** One row per line (the line breaks of the statement). */
        headline: linesSchema(MAX_HEADLINE_LINES, 40, "Headline").refine((v) => splitLines(v).length > 0, "Enter the headline"),
        supporting: optionalText(400, "Supporting text"),
        image: imageSchema.optional(),
      })
      .strict(),
    why: z
      .object({
        enabled: z.boolean(),
        title: text(1, 60, "Section title"),
        heading: text(1, 120, "Intro heading"),
        image: imageSchema.optional(),
        blocks: z.array(storyBlockSchema).min(1, "Add at least one content block").max(MAX_STORY_BLOCKS, `At most ${MAX_STORY_BLOCKS} content blocks`),
        closing: optionalText(600, "Closing text"),
        attribution: optionalText(80, "Attribution"),
      })
      .strict(),
    journey: z
      .object({
        enabled: z.boolean(),
        heading: text(1, 90, "Section heading"),
        subtitle: optionalText(200, "Subtitle"),
        steps: z.array(journeyStepSchema).min(MIN_JOURNEY_STEPS, "Add at least one step").max(MAX_JOURNEY_STEPS, `At most ${MAX_JOURNEY_STEPS} steps`),
      })
      .strict(),
  })
  .strict();
export type OurStoryPayload = z.infer<typeof ourStoryPayloadSchema>;

export const OUR_STORY_MODULE = {
  id: "our-story",
  label: "Our Story",
  kind: "singleton",
  payload: ourStoryPayloadSchema as unknown as z.ZodType<Record<string, unknown>>,
} as const satisfies CmsModuleDefinition;

/** Initial content: editable, with no figures, dates or claims. */
export const OUR_STORY_DEFAULT: OurStoryPayload = {
  hero: {
    enabled: true,
    headline: "Built with love,\npatience,\nhonesty &\nreal feedback",
    supporting: "The story behind Luftansa Fragrance Craft Hub: how we listen, learn and refine every fragrance before it reaches you.",
  },
  why: {
    enabled: true,
    title: "Why We Started",
    heading: "Before building anything, we studied two things.",
    blocks: [
      {
        heading: "The Perfume Makers",
        description: "People who create and sell perfumes.",
        points: "What goes into a fragrance is rarely explained.\nPricing can be hard to make sense of.\nToo much hype, too little information.",
      },
      {
        heading: "The Consumers",
        description: "People who buy and wear perfumes.",
        points: "Choosing a fragrance can feel like guesswork.\nDescriptions rarely help you imagine the scent.\nLittle guidance on what suits which moment.",
      },
    ],
    closing: "So we built Luftansa: distinctive fragrances for every mood, moment and personality, described simply and honestly.",
  },
  journey: {
    enabled: true,
    heading: "A Thoughtful Process from Start to Product",
    subtitle: "How a Luftansa fragrance comes together, one careful step at a time.",
    steps: [
      { title: "Research & Development", description: "Learning the fragrance industry, and researching ingredients, fragrance profiles and the market." },
      { title: "Consumer Survey", description: "Collecting feedback from perfume users to understand their fragrance preferences." },
      { title: "Formulation & Prototyping", description: "Creating fragrance formulas and refining them based on feedback." },
      { title: "Comparison & Testing", description: "Comparing samples side by side and refining the fragrance experience based on feedback." },
      { title: "Final Product", description: "Finalising the fragrances, their presentation and packaging, and launching them." },
    ],
  },
};

/* ------------------------------------------------------------ rendering --- */

export interface StoryImageView {
  src: string;
  alt: string;
  position: string;
}

export interface OurStoryView {
  hero?: { lines: string[]; supporting?: string; image?: StoryImageView };
  why?: {
    title: string;
    heading: string;
    image?: StoryImageView;
    blocks: { number: number; heading: string; description?: string; points: string[] }[];
    closing: string[];
    attribution?: string;
  };
  journey?: {
    heading: string;
    subtitle?: string;
    steps: { number: number; period?: string; title: string; description: string; caption?: string; image?: StoryImageView }[];
  };
}

const position = (f: FocalPoint) => `${f.x}% ${f.y}%`;

/** View of a payload (pure). `toUrl` resolves a Media Library key. Disabled sections are left out. */
export function toOurStoryView(p: OurStoryPayload, toUrl: (key: string) => string): OurStoryView {
  const img = (i?: StoryImage): StoryImageView | undefined => (i ? { src: toUrl(i.key), alt: i.alt, position: position(i.focal) } : undefined);
  return {
    hero: p.hero.enabled ? { lines: splitLines(p.hero.headline), supporting: p.hero.supporting, image: img(p.hero.image) } : undefined,
    why: p.why.enabled
      ? {
          title: p.why.title,
          heading: p.why.heading,
          image: img(p.why.image),
          blocks: p.why.blocks.map((b, i) => ({ number: i + 1, heading: b.heading, description: b.description, points: splitLines(b.points) })),
          closing: splitLines(p.why.closing),
          attribution: p.why.attribution,
        }
      : undefined,
    journey: p.journey.enabled
      ? {
          heading: p.journey.heading,
          subtitle: p.journey.subtitle,
          steps: p.journey.steps.map((s, i) => ({ number: i + 1, period: s.period, title: s.title, description: s.description, caption: s.caption, image: img(s.image) })),
        }
      : undefined,
  };
}

export const hasAnySection = (v: OurStoryView) => Boolean(v.hero || v.why || v.journey);

/**
 * What the page shows (pure). null = deactivated (the page then sends
 * visitors to the homepage brand story). Defaults until something is
 * published, while the database is unavailable, or if stored content is
 * no longer valid.
 */
export function resolveOurStory(result: { source: "cms" | "fallback"; items: readonly { payload: unknown }[] }, toUrl: (key: string) => string): OurStoryView | null {
  if (result.source === "cms" && result.items.length === 0) return null;
  const parsed = ourStoryPayloadSchema.safeParse(result.items[0]?.payload);
  return toOurStoryView(parsed.success ? parsed.data : OUR_STORY_DEFAULT, toUrl);
}
