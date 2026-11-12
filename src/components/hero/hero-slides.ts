/**
 * Hero carousel content. Edit copy and destinations here.
 *
 * `image` is optional. Leave it undefined until genuine Luftansa product
 * photography is uploaded to S3; the slide then shows a clean ivory panel.
 * When a photo is available, set e.g.:
 *
 *   image: {
 *     key: "hero/luftansa-edp-100ml.jpg", // S3 object key (private bucket)
 *     alt: "Luftansa Eau de Parfum 100 ml bottle beside its box",
 *     objectPosition: "60% 50%",            // optional focal point
 *   }
 */
export interface HeroSlideImage {
  key: string;
  alt: string;
  objectPosition?: string;
}

export interface HeroSlide {
  id: string;
  label: string;
  heading: string;
  description: string;
  cta: { text: string; href: string };
  image?: HeroSlideImage;
}

export const HERO_SLIDES: readonly HeroSlide[] = [
  {
    id: "defines-you",
    label: "Luftansa Fragrances",
    heading: "A Fragrance That Defines You",
    description:
      "A premium collection of 41 signature scents, crafted for every mood, occasion and personality.",
    cta: { text: "Explore the Collection", href: "/collections" },
  },
  {
    id: "signature-scent",
    label: "Luftansa Fragrances",
    heading: "Discover Your Signature Scent",
    description:
      "Find a fragrance that reflects your individuality and makes every moment memorable.",
    cta: { text: "Discover Fragrances", href: "/shop" },
  },
  {
    id: "every-drop",
    label: "Luftansa Fragrances",
    heading: "Elegance in Every Drop",
    description: "Experience distinctive fragrances designed to leave a lasting impression.",
    cta: { text: "Shop All Fragrances", href: "/shop" },
  },
];
