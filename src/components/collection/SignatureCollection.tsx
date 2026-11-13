import { getAssetUrl } from "@/lib/assets";
import { getProductsBySlugs, SIGNATURE_PRODUCT_SLUGS } from "@/data/products";
import { ProductCard, type ProductCardData } from "./ProductCard";

/**
 * "Our Collection: Signature Fragrances" (Server Component). Product data comes
 * from src/data/products.ts; S3 image keys resolve to URLs on the server.
 */
export function SignatureCollection({ slugs = SIGNATURE_PRODUCT_SLUGS }: { slugs?: readonly string[] }) {
  const products: ProductCardData[] = getProductsBySlugs(slugs).map(({ image, ...p }) => ({
    ...p,
    image: image
      ? { src: getAssetUrl(image.key), alt: image.alt, objectPosition: image.objectPosition }
      : undefined,
  }));

  if (products.length === 0) return null;

  return (
    <section aria-labelledby="signature-heading" className="bg-brand-cream">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-8 sm:py-20 lg:py-24">
        <header className="mx-auto max-w-2xl text-center">
          <p className="flex items-center justify-center gap-4 text-[11px] font-medium uppercase tracking-[0.32em] text-brand-black sm:gap-6 sm:text-[13px] sm:tracking-[0.36em]">
            <span aria-hidden="true" className="h-px w-10 bg-brand-gold/70 sm:w-24" />
            Our Collection
            <span aria-hidden="true" className="h-px w-10 bg-brand-gold/70 sm:w-24" />
          </p>
          <h2
            id="signature-heading"
            className="mt-3 font-serif text-[40px] leading-[1.08] font-semibold italic tracking-[-0.01em] text-brand-black min-[400px]:text-[44px] sm:mt-4 sm:text-[56px] lg:text-[64px]"
          >
            Signature Fragrances
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-pretty text-brand-text/80 sm:text-[17px]">
            Discover our curated collection of premium perfumes, crafted for every mood and occasion.
          </p>
        </header>

        <ul className="mt-10 grid grid-cols-1 gap-5 sm:mt-14 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-7">
          {products.map((product) => (
            <li key={product.slug} className="mx-auto w-full max-w-[440px] sm:max-w-none">
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
