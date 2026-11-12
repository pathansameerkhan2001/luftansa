import { getAssetUrl } from "@/lib/assets";
import { HeroCarousel, type ResolvedHeroSlide } from "./HeroCarousel";
import { HERO_SLIDES, type HeroSlide } from "./hero-slides";

interface HeroSectionProps {
  slides?: readonly HeroSlide[];
}

/**
 * Server Component: resolves S3 asset keys to URLs on the server (CloudFront or
 * the private /media route) and hands plain data to the client carousel.
 */
export function HeroSection({ slides = HERO_SLIDES }: HeroSectionProps) {
  const resolved: ResolvedHeroSlide[] = slides.map(({ image, ...slide }) => ({
    ...slide,
    image: image
      ? { src: getAssetUrl(image.key), alt: image.alt, objectPosition: image.objectPosition }
      : undefined,
  }));

  return <HeroCarousel slides={resolved} />;
}
