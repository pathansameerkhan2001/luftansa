import type { ProductOption } from "@/data/products";

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
  notes: { top?: string; heart?: string; base?: string };
}
