import { getAssetUrl } from "@/lib/assets";
import { HERO_SLIDES, type HeroBannerConfig } from "./hero-banner";
import { HeroStage, type ResolvedHeroImage } from "./HeroStage";

interface HeroSectionProps {
  slides?: readonly HeroBannerConfig[];
}

/**
 * Image-only, full-width hero (Server Component). No text, controls or
 * overlays (a pause control appears only when several slides rotate).
 * S3 keys resolve on the server (CloudFront or the private /media route).
 *
 * The previous text carousel (HeroCarousel + hero-slides) is kept in this folder
 * unchanged and can be re-enabled by rendering <HeroCarousel /> again.
 */
export function HeroSection({ slides = HERO_SLIDES }: HeroSectionProps) {
  const resolved: ResolvedHeroImage[] = slides.flatMap((banner) => {
    const src = banner.key ? getAssetUrl(banner.key) : banner.src;
    return src ? [{ src, alt: banner.alt, position: banner.objectPosition ?? { base: "50% 50%" } }] : [];
  });
  if (resolved.length === 0) return null;

  return <HeroStage slides={resolved} />;
}
