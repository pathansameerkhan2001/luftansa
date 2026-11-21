/**
 * Hero Section CMS module (single record).
 *
 * Desktop and mobile each have their own image (required on desktop; mobile
 * falls back to the desktop image), focal point and optional muted video.
 * Phones never receive the desktop video: when no mobile video is set, phones
 * show the image only. Heading, subtitle and button are optional and render
 * only when filled in.
 *
 * Content stores Media Library object keys, so the Media Library's "where
 * used" check protects every referenced file from deletion.
 */
import { z } from "zod";
import type { CmsModuleDefinition } from "../schemas";
import { CENTER_FOCAL, focalPointSchema, mediaKeySchema, optionalCtaSchema, optionalTextSchema } from "../fields";

const imageSchema = z.object({
  key: mediaKeySchema("image"),
  alt: z.string().trim().min(1, "Describe the image for screen readers").max(200, "Alt text must be 200 characters or fewer"),
}).strict();

const videoSchema = z.object({ key: mediaKeySchema("video") }).strict();

export const heroPayloadSchema = z
  .object({
    desktop: z
      .object({
        image: imageSchema,
        focal: focalPointSchema.default(CENTER_FOCAL),
        video: videoSchema.optional(),
      })
      .strict(),
    mobile: z
      .object({
        image: imageSchema.optional(),
        focal: focalPointSchema.default(CENTER_FOCAL),
        video: videoSchema.optional(),
      })
      .strict(),
    heading: optionalTextSchema(120, "Heading"),
    subtitle: optionalTextSchema(240, "Subtitle"),
    cta: optionalCtaSchema,
  })
  .strict();

export type HeroPayload = z.infer<typeof heroPayloadSchema>;
export type HeroPayloadInput = z.input<typeof heroPayloadSchema>;

export const HERO_MODULE = {
  id: "hero",
  label: "Hero Section",
  kind: "singleton",
  payload: heroPayloadSchema as unknown as z.ZodType<Record<string, unknown>>,
} as const satisfies CmsModuleDefinition;

/* ------------------------------------------------------------ rendering --- */

export interface HeroViewMedia {
  imageSrc: string;
  alt: string;
  /** CSS object-position, e.g. "40% 50%". */
  position: string;
  videoSrc?: string;
}

export interface HeroView {
  desktop: HeroViewMedia;
  mobile: HeroViewMedia;
  heading?: string;
  subtitle?: string;
  cta?: { label: string; href: string };
}

const position = (f: { x: number; y: number }) => `${f.x}% ${f.y}%`;

/**
 * What the storefront renders for a published (or previewed) hero (pure).
 * `toUrl` resolves an object key (getAssetUrl on the server).
 */
export function resolveHeroView(payload: HeroPayload, toUrl: (key: string) => string): HeroView {
  const mobileImage = payload.mobile.image ?? payload.desktop.image;
  return {
    desktop: {
      imageSrc: toUrl(payload.desktop.image.key),
      alt: payload.desktop.image.alt,
      position: position(payload.desktop.focal),
      ...(payload.desktop.video ? { videoSrc: toUrl(payload.desktop.video.key) } : {}),
    },
    mobile: {
      imageSrc: toUrl(mobileImage.key),
      alt: mobileImage.alt,
      position: position(payload.mobile.focal),
      // Never the desktop video: phones without a mobile video show the image only.
      ...(payload.mobile.video ? { videoSrc: toUrl(payload.mobile.video.key) } : {}),
    },
    ...(payload.heading ? { heading: payload.heading } : {}),
    ...(payload.subtitle ? { subtitle: payload.subtitle } : {}),
    ...(payload.cta ? { cta: payload.cta } : {}),
  };
}

/** Every Media Library key the hero references (for tests and usage checks). */
export function heroMediaKeys(payload: HeroPayload): string[] {
  return [payload.desktop.image.key, payload.desktop.video?.key, payload.mobile.image?.key, payload.mobile.video?.key].filter((k): k is string => Boolean(k));
}
