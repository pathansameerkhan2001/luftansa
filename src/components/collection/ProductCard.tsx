"use client";

import Image from "next/image";
import { Heart, ShoppingCart } from "lucide-react";
import { useId, useState } from "react";
import { PerfumeBottleIcon } from "@/components/benefits/BenefitsStrip";
import { formatInr, priceForSize, type BottleSizeMl } from "@/data/products";

export interface ProductCardData {
  slug: string;
  name: string;
  description?: string;
  sizes: readonly BottleSizeMl[];
  image?: { src: string; alt: string; objectPosition?: string };
}

interface ProductCardProps {
  product: ProductCardData;
  /** Wire to the cart once it exists. */
  onAddToCart?: (slug: string, size: BottleSizeMl) => void;
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const { slug, name, description, sizes, image } = product;
  const [size, setSize] = useState<BottleSizeMl | undefined>(sizes[0]);
  const [wishlisted, setWishlisted] = useState(false);
  const sizeGroupId = useId();

  return (
    <article className="flex h-full flex-col rounded-[22px] bg-brand-ivory p-3 shadow-[0_1px_2px_rgba(23,23,23,0.04),0_12px_32px_-12px_rgba(23,23,23,0.14)] ring-1 ring-brand-gold/15 sm:p-3.5">
      {/* Image */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-brand-cream">
        {image ? (
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
            className="object-cover"
            style={{ objectPosition: image.objectPosition ?? "50% 50%" }}
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_35%,var(--brand-ivory)_0%,var(--brand-cream)_70%)]"
          >
            <div className="absolute inset-3 rounded-xl border border-brand-gold/30" />
            <PerfumeBottleIcon
              className="absolute top-1/2 left-1/2 size-14 -translate-x-1/2 -translate-y-1/2 text-brand-gold/45"
              strokeWidth={0.75}
            />
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex flex-1 flex-col px-2 pt-5 pb-2 sm:px-3">
        <h3 className="font-serif lining-nums text-[26px] leading-tight font-semibold text-brand-black">
          {name}
        </h3>
        {description ? (
          <p className="mt-1.5 text-[14px] leading-relaxed text-brand-text/75">{description}</p>
        ) : null}

        {sizes.length > 0 && size !== undefined ? (
          <>
            <fieldset className="mt-4">
              <legend id={sizeGroupId} className="sr-only">
                Choose a size for {name}
              </legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={sizeGroupId}>
                {sizes.map((ml) => {
                  const selected = ml === size;
                  return (
                    <button
                      key={ml}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setSize(ml)}
                      className={`h-9 min-w-[64px] rounded-full border px-3.5 text-[13px] tracking-[0.02em] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold ${
                        selected
                          ? "border-brand-black bg-brand-black text-white"
                          : "border-brand-black/20 text-brand-text hover:border-brand-gold"
                      }`}
                    >
                      {ml} ml
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-auto flex items-center justify-between gap-3 pt-5">
              <p className="font-serif lining-nums text-[28px] leading-none font-semibold text-brand-black" aria-live="polite">
                {formatInr(priceForSize(size))}
                <span className="sr-only"> for {size} ml</span>
              </p>
              <button
                type="button"
                onClick={() => setWishlisted((w) => !w)}
                aria-pressed={wishlisted}
                aria-label={wishlisted ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
                className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl border border-brand-gold/70 text-brand-black transition-colors duration-200 hover:bg-brand-gold/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
              >
                <Heart
                  aria-hidden="true"
                  className={`size-[22px] transition-colors ${wishlisted ? "fill-brand-gold text-brand-gold" : ""}`}
                  strokeWidth={1.5}
                />
              </button>
            </div>

            <button
              type="button"
              onClick={() => onAddToCart?.(slug, size)}
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-brand-black text-[15px] font-medium tracking-[0.02em] text-white transition-colors duration-200 hover:bg-brand-text focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold"
            >
              <ShoppingCart aria-hidden="true" className="size-5" strokeWidth={1.5} />
              Add to Cart
            </button>
          </>
        ) : (
          <p className="mt-auto pt-5 text-[13px] text-brand-text/60">Sizes &amp; pricing coming soon</p>
        )}
      </div>
    </article>
  );
}
