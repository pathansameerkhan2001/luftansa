import type { ReactNode } from "react";
import { FlourishIcon } from "./icons";
import { ProductCard, type PlaceholderKind, type ProductCardData } from "./ProductCard";
import { ProductCarousel } from "./ProductCarousel";

interface CollectionPanelProps {
  id: string;
  title: string;
  subtitle: string;
  products: readonly ProductCardData[];
  placeholder?: PlaceholderKind;
  /** Rendered in place of the carousel when the collection has no products yet. */
  emptyState?: ReactNode;
}

/** Rounded, gold-bordered collection panel with crest, serif heading and product carousel. */
export function CollectionPanel({ id, title, subtitle, products, placeholder, emptyState }: CollectionPanelProps) {
  const headingId = `${id}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      className="relative flex flex-col rounded-[28px] border border-brand-gold/45 bg-[linear-gradient(180deg,#fffaf1_0%,var(--brand-ivory)_100%)] px-4 pt-11 pb-6 shadow-[0_18px_40px_-28px_rgba(120,92,40,0.35)] min-[400px]:px-5 sm:rounded-[32px] sm:px-9 sm:pt-14 sm:pb-9"
    >
      {/* Crest sits on the top border; cream backing breaks the line around it. */}
      <span
        aria-hidden="true"
        className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[linear-gradient(to_bottom,var(--brand-cream)_50%,#fffaf1_50%)] px-3 text-brand-gold sm:px-4"
      >
        <FlourishIcon className="size-8 sm:size-10" />
      </span>

      <header className="text-center">
        <h2
          id={headingId}
          className="font-serif text-[26px] leading-[1.1] font-semibold tracking-[0.04em] text-balance text-brand-black uppercase min-[400px]:text-[30px] sm:text-[38px] xl:text-[34px] 2xl:text-[40px]"
        >
          {title}
        </h2>
        <p className="mx-auto mt-2.5 max-w-md font-serif text-[18px] leading-snug text-pretty text-brand-text/85 sm:mt-3 sm:text-[21px]">
          {subtitle}
        </p>
      </header>

      <div className="mt-7 flex flex-1 flex-col sm:mt-9">
        {products.length > 0 ? (
          <ProductCarousel label={`${title} products`}>
            {products.map((product) => (
              <ProductCard key={product.slug} product={product} placeholder={placeholder} />
            ))}
          </ProductCarousel>
        ) : (
          emptyState
        )}
      </div>
    </section>
  );
}
