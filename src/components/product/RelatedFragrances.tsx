import { ProductCard, type ProductCardData } from "@/components/collection/ProductCard";

/**
 * Related fragrances: same collection first, then the same category (see
 * selectRelated). Horizontal swipe row on phones, grid from the tablet size.
 */
export function RelatedFragrances({ products }: { products: readonly ProductCardData[] }) {
  if (products.length === 0) return null;

  return (
    <section aria-labelledby="related-heading" className="bg-brand-ivory">
      <div className="mx-auto max-w-[1320px] px-4 py-14 sm:px-8 sm:py-20">
        <header className="text-center">
          <p className="flex items-center justify-center gap-4 text-[11px] font-medium tracking-[0.32em] text-brand-black uppercase sm:text-[12px]">
            <span aria-hidden="true" className="h-px w-10 bg-brand-gold/70 sm:w-16" />
            You May Also Love
            <span aria-hidden="true" className="h-px w-10 bg-brand-gold/70 sm:w-16" />
          </p>
          <h2 id="related-heading" className="mt-3 font-serif text-[34px] leading-[1.08] font-semibold italic text-brand-black sm:text-[46px]">
            Related Fragrances
          </h2>
        </header>

        <ul className="-mx-4 mt-9 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-px-4 px-4 pt-1 pb-4 [scrollbar-width:none] sm:mx-0 sm:mt-12 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
          {products.map((p) => (
            <li key={p.slug} className="w-[74%] max-w-[320px] shrink-0 snap-start sm:w-auto sm:max-w-none">
              <ProductCard product={p} imageSizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 74vw" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
