"use client";

import Image from "next/image";
import { Heart, ShoppingCart } from "lucide-react";
import { useId, useState } from "react";
import { PerfumeBottleIcon } from "@/components/benefits/BenefitsStrip";
import { formatInr } from "@/data/products";
import { RollOnBottleIcon } from "./icons";

export type PlaceholderKind = "spray" | "roll-on";

/** One purchasable option (a bottle size or roll-on variant) with its confirmed price. */
export interface ProductOption {
  id: string;
  label: string;
  priceInr: number;
}

export interface ProductCardData {
  slug: string;
  name: string;
  description?: string;
  options: readonly ProductOption[];
  image?: { src: string; alt: string; objectPosition?: string };
}

interface ProductCardProps {
  product: ProductCardData;
  /** Which line icon the neutral placeholder shows when no photograph exists. */
  placeholder?: PlaceholderKind;
  /** Wire to the cart once it exists. */
  onAddToCart?: (slug: string, optionId: string) => void;
}

export function ProductCard({ product, placeholder = "spray", onAddToCart }: ProductCardProps) {
  const { slug, name, description, options, image } = product;
  const [optionId, setOptionId] = useState<string | undefined>(options[0]?.id);
  const [wishlisted, setWishlisted] = useState(false);
  const optionGroupId = useId();
  const selected = options.find((o) => o.id === optionId);
  const PlaceholderIcon = placeholder === "roll-on" ? RollOnBottleIcon : PerfumeBottleIcon;

  return (
    <article className="flex h-full flex-col rounded-[22px] bg-white/80 p-2.5 shadow-[0_1px_2px_rgba(23,23,23,0.04),0_14px_30px_-14px_rgba(23,23,23,0.18)] ring-1 ring-brand-gold/15 sm:p-3">
      {/* Image */}
      <div data-carousel-media className="relative aspect-[6/5] overflow-hidden rounded-2xl bg-brand-cream">
        {image ? (
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(min-width: 1280px) 22vw, (min-width: 640px) 45vw, 85vw"
            className="object-cover"
            style={{ objectPosition: image.objectPosition ?? "50% 50%" }}
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_35%,var(--brand-ivory)_0%,var(--brand-cream)_70%)]"
          >
            <div className="absolute inset-3 rounded-xl border border-brand-gold/30" />
            <PlaceholderIcon
              className="absolute top-1/2 left-1/2 size-14 -translate-x-1/2 -translate-y-1/2 text-brand-gold/50"
              strokeWidth={0.75}
            />
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex flex-1 flex-col px-1.5 pt-4 pb-1.5 sm:px-3 sm:pt-5 sm:pb-2">
        <h3 className="font-serif lining-nums text-[24px] leading-tight font-semibold text-brand-black sm:text-[26px]">
          {name}
        </h3>
        {description ? (
          <p className="mt-1.5 text-[14px] leading-relaxed text-brand-text/75">{description}</p>
        ) : null}

        {selected ? (
          <>
            <fieldset className="mt-3.5">
              <legend id={optionGroupId} className="sr-only">
                Choose a size for {name}
              </legend>
              <div className="flex flex-wrap gap-1.5 sm:gap-2" role="radiogroup" aria-labelledby={optionGroupId}>
                {options.map((option) => {
                  const isSelected = option.id === selected.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setOptionId(option.id)}
                      className={`h-9 min-w-[54px] rounded-full border px-2.5 text-[13px] whitespace-nowrap tracking-[0.02em] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold sm:min-w-[64px] sm:px-3.5 ${
                        isSelected
                          ? "border-brand-black bg-brand-black text-white"
                          : "border-brand-gold/45 bg-white/60 text-brand-text hover:border-brand-gold"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-auto flex items-center justify-between gap-3 pt-4">
              <p
                className="font-serif lining-nums text-[28px] leading-none font-semibold text-brand-black"
                aria-live="polite"
              >
                {formatInr(selected.priceInr)}
                <span className="sr-only"> for {selected.label}</span>
              </p>
              <button
                type="button"
                onClick={() => setWishlisted((w) => !w)}
                aria-pressed={wishlisted}
                aria-label={wishlisted ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-brand-gold/70 bg-white/70 text-brand-black transition-colors duration-200 hover:bg-brand-gold/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
              >
                <Heart
                  aria-hidden="true"
                  className={`size-[21px] transition-colors ${wishlisted ? "fill-brand-gold text-brand-gold" : ""}`}
                  strokeWidth={1.5}
                />
              </button>
            </div>

            <button
              type="button"
              onClick={() => onAddToCart?.(slug, selected.id)}
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
