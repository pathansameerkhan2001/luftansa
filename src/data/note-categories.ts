/**
 * Fragrance-note categories for the homepage "Explore by Notes" section.
 *
 * Images are atmospheric ingredient photographs (Unsplash License, free for
 * commercial use). They show no bottles, labels, logos or branding and are
 * NOT product photographs. Replace with Luftansa photography by setting
 * `image.key` (an S3 key under "categories/") instead of `image.src`.
 *
 * `href` is intentionally unset: no collection route or note filtering exists
 * yet, and the card renders a non-link button while it is missing. Once the
 * route exists, set e.g. `href: "/collections?note=citrus"`.
 *
 * Product-to-note assignments are NOT stored here; they must be added to the
 * catalogue (src/data/products.ts) only once confirmed.
 */
export type NoteSlug = "citrus" | "woody" | "floral" | "oud";

export interface NoteCategoryImage {
  /** S3 object key (preferred once genuine photography exists). */
  key?: string;
  /** Absolute URL on an allowed host (see next.config.ts). */
  src?: string;
  alt: string;
  objectPosition?: string;
  credit?: { photographer: string; url: string };
}

export interface NoteCategory {
  slug: NoteSlug;
  /** Overlay label on the image, e.g. "Citrus Notes". */
  label: string;
  title: string;
  description: string;
  image: NoteCategoryImage;
  /** Filtered collection URL. Leave unset until the route exists. */
  href?: string;
}

export const NOTE_CATEGORIES: readonly NoteCategory[] = [
  {
    slug: "citrus",
    label: "Citrus Notes",
    title: "Citrus Collection",
    description: "Fresh, vibrant and energizing scents.",
    image: {
      src: "https://images.unsplash.com/photo-1606926167690-07a1edafd407?w=1200&q=80&fm=jpg",
      alt: "Halved oranges and fresh green leaves on a warm golden-yellow background",
      objectPosition: "50% 50%",
      credit: { photographer: "Tamanna Rumee", url: "https://unsplash.com/photos/bc8CkLx1G4k" },
    },
  },
  {
    slug: "woody",
    label: "Woody Notes",
    title: "Woody Collection",
    description: "Warm, rich and earthy fragrances.",
    image: {
      src: "https://images.unsplash.com/photo-1617615181070-ab4788da6d03?w=1200&q=80&fm=jpg",
      alt: "Stacked natural wood logs showing warm brown grain and growth rings",
      objectPosition: "50% 50%",
      credit: { photographer: "Stanislav Churikov", url: "https://unsplash.com/photos/R-dqzxCYgOM" },
    },
  },
  {
    slug: "floral",
    label: "Floral Notes",
    title: "Floral Collection",
    description: "Elegant, soft and timeless fragrances.",
    image: {
      src: "https://images.unsplash.com/photo-1762328873090-b6bd990311ee?w=1200&q=80&fm=jpg",
      alt: "Close-up of soft pink rose petals and buds",
      objectPosition: "50% 50%",
      credit: { photographer: "Zulfugar Karimov", url: "https://unsplash.com/photos/DfEwgXjEyh4" },
    },
  },
  {
    slug: "oud",
    label: "Oud Notes",
    title: "Oud Collection",
    description: "Deep, luxurious and long-lasting scents.",
    image: {
      src: "https://images.unsplash.com/photo-1764061148216-f786bcc4b353?w=1200&q=80&fm=jpg",
      alt: "Golden amber resin on dark, textured wood bark",
      objectPosition: "40% 50%",
      credit: { photographer: "Alexandre Juca", url: "https://unsplash.com/photos/QjaS_ml508w" },
    },
  },
];
