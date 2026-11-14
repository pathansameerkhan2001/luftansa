/**
 * Image-only hero banner content.
 *
 * Provide EITHER `key` (an S3 object key in the private bucket, preferred once
 * genuine Luftansa photography exists, e.g. "hero/home-banner.jpg") OR `src`
 * (an absolute URL whose host is allowed in next.config.ts).
 *
 * Current image: "Beige fabric abstract curves" by Pawel Czerwinski on Unsplash
 * (Unsplash License, free for commercial use):
 * https://unsplash.com/photos/beige-fabric-abstract-curves-2a2xFRwkr_U
 * It contains no bottles, labels or branding. Replace with a Luftansa photo.
 */
export interface HeroBannerConfig {
  key?: string;
  src?: string;
  alt: string;
  /** CSS object-position, per breakpoint, so the focal point survives cropping. */
  objectPosition?: { base: string; lg?: string };
}

export const HERO_BANNER: HeroBannerConfig = {
  src: "https://images.unsplash.com/photo-1714682597753-a646ba506cee",
  alt: "Soft folds of warm ivory silk forming an abstract, petal-like shape in gentle light",
  objectPosition: { base: "40% 50%", lg: "50% 50%" },
};

/**
 * Hero slides, in order. Only one genuine image is configured today, so the
 * hero is static. Add further slides (preferably S3 keys under "hero/") to
 * enable the crossfading rotation.
 */
export const HERO_SLIDES: readonly HeroBannerConfig[] = [HERO_BANNER];
