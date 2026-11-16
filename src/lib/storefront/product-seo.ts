/**
 * Product page SEO helpers (pure, no I/O). Confirmed data only.
 */
import { formatInr, startingPrice, type ProductOption } from "@/data/products";
import { STORE_NAME } from "@/data/store";

export interface SeoProductInput {
  name: string;
  description?: string;
  category: string;
  options: readonly ProductOption[];
}

/** Meta description: the product's description (trimmed to ~160 chars), or a factual summary. */
export function productMetaDescription(product: SeoProductInput): string {
  if (product.description) {
    const d = product.description.replace(/\s+/g, " ").trim();
    if (d) return d.length > 160 ? `${d.slice(0, 157).trimEnd()}…` : d;
  }
  const from = startingPrice(product.options);
  const sizes = product.options.map((o) => o.label).join(", ");
  const parts = [`${product.name}, a ${product.category.toLowerCase()} by ${STORE_NAME}.`];
  if (sizes) parts.push(`Available in ${sizes}${from !== undefined ? `, from ${formatInr(from)}` : ""}.`);
  return parts.join(" ");
}

/** JSON unicode escape for "<" (backslash + u003c). */
const LT_ESCAPE = `${String.fromCharCode(92)}u003c`;

/** schema.org Product JSON-LD (no ratings or reviews), safe to embed in a <script>. */
export function productJsonLd(product: SeoProductInput, images: readonly { src: string }[]): string {
  const prices = product.options.map((o) => o.priceInr);
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    category: product.category,
    brand: { "@type": "Brand", name: STORE_NAME },
    ...(product.description ? { description: product.description } : {}),
    ...(images.length > 0 ? { image: images.map((i) => i.src) } : {}),
  };
  if (prices.length > 0) {
    data.offers = {
      "@type": "AggregateOffer",
      priceCurrency: "INR",
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: prices.length,
    };
  }
  // Escape "<" so product text can never close the script element.
  return JSON.stringify(data).replace(/</g, LT_ESCAPE);
}
