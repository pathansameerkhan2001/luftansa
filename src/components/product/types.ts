import type { ProductOption } from "@/data/products";

export interface NoteDetail {
  name: string;
  description?: string;
  image?: { src: string; alt: string };
}

/** Serializable product data for the product details page (built on the server). */
export interface ProductDetailData {
  slug: string;
  name: string;
  category: string;
  description?: string;
  perfectFor?: string;
  concentration?: string;
  gender?: string;
  options: readonly ProductOption[];
  images: readonly { src: string; alt: string; objectPosition?: string }[];
  keywords?: readonly string[];
  /** Structured notes with individual imagery */
  fragranceNotes?: {
    top: readonly NoteDetail[];
    heart: readonly NoteDetail[];
    base: readonly NoteDetail[];
  };
  /** Legacy string notes for backwards compatibility */
  notes: { top?: string; heart?: string; base?: string };
}
