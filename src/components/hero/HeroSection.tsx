import { getAssetUrl } from "@/lib/assets";
import { visibilityClassName } from "@/lib/cms/fields";
import { loadPublished } from "@/lib/cms/loader";
import { HERO_MODULE, heroPayloadSchema, resolveHeroView, type HeroPayload } from "@/lib/cms/modules/hero";
import { HERO_SLIDES, type HeroBannerConfig } from "./hero-banner";
import { HeroBanner } from "./HeroBanner";
import { HeroStage, type ResolvedHeroImage } from "./HeroStage";

/**
 * Today's approved hero: image-only, full width (no text, controls or overlays).
 * Shown until a Hero Section is published in the admin, and whenever the
 * database cannot be read.
 */
export function FallbackHero({ slides = HERO_SLIDES }: { slides?: readonly HeroBannerConfig[] }) {
  const resolved: ResolvedHeroImage[] = slides.flatMap((banner) => {
    const src = banner.key ? getAssetUrl(banner.key) : banner.src;
    return src ? [{ src, alt: banner.alt, position: banner.objectPosition ?? { base: "50% 50%" } }] : [];
  });
  if (resolved.length === 0) return null;
  return <HeroStage slides={resolved} />;
}

/** Renders a stored hero payload, or null when it no longer satisfies the schema. */
export function renderHeroPayload(payload: unknown, visibility: { desktop: boolean; mobile: boolean }) {
  const parsed = heroPayloadSchema.safeParse(payload);
  if (!parsed.success) return null;
  const className = visibilityClassName(visibility);
  if (className === null) return null;
  return <HeroBanner view={resolveHeroView(parsed.data, getAssetUrl)} className={className} />;
}

/**
 * Homepage hero (Server Component).
 *   - Nothing published yet, or database unavailable -> today's hero (unchanged).
 *   - Published                                     -> the CMS hero.
 *   - Deactivated in the admin                      -> no hero.
 */
export async function HeroSection() {
  const result = await loadPublished<HeroPayload>(HERO_MODULE, []);
  if (result.source === "fallback") return <FallbackHero />;
  const item = result.items[0];
  if (!item) return null;
  const rendered = renderHeroPayload(item.payload, item.visibility);
  if (rendered === null && !heroPayloadSchema.safeParse(item.payload).success) {
    // Stored content no longer matches the schema: keep the site whole.
    console.error("[cms] hero: published payload is invalid, serving today's hero");
    return <FallbackHero />;
  }
  return rendered;
}
