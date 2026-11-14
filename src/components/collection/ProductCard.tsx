"use client";

import Image from "next/image";
import { useState } from "react";
import { PerfumeBottleIcon } from "@/components/benefits/BenefitsStrip";
import { AddToCartButton, PricePanel, SizePills } from "@/components/pricing/PurchaseControls";
import { formatInr, type ProductOption } from "@/data/products";
import { dispatchAddToCart, dispatchWishlist } from "@/lib/cart-events";
import { RollOnBottleIcon } from "./icons";

export type { ProductOption } from "@/data/products";
export type PlaceholderKind = "spray" | "roll-on";

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
}

export function ProductCard({ product, placeholder = "spray" }: ProductCardProps) {
  const { slug, name, description, options, image } = product;
  const [optionId, setOptionId] = useState<string | undefined>(options[0]?.id);
  const [wishlisted, setWishlisted] = useState(false);
  const [status, setStatus] = useState("");
  const selected = options.find((o) => o.id === optionId);
  const PlaceholderIcon = placeholder === "roll-on" ? RollOnBottleIcon : PerfumeBottleIcon;

  const addToCart = () => {
    if (!selected) return;
    dispatchAddToCart({ slug, name, optionId: selected.id, optionLabel: selected.label, priceInr: selected.priceInr });
    setStatus("Online ordering is coming soon.");
  };

  const toggleWishlist = () => {
    const next = !wishlisted;
    setWishlisted(next);
    dispatchWishlist({ slug, name, wishlisted: next });
  };

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
            <div className="mt-3.5">
              <SizePills
                options={options}
                selectedId={selected.id}
                onSelect={(id) => {
                  setOptionId(id);
                  setStatus("");
                }}
                label={`Choose a size for ${name}`}
              />
            </div>

            <div className="mt-auto pt-4">
              <PricePanel option={selected} productName={name} wishlisted={wishlisted} onWishlist={toggleWishlist} />
            </div>

            <div className="mt-3">
              <AddToCartButton
                onClick={addToCart}
                srDetail={`${name}, ${selected.label}, ${formatInr(selected.priceInr)}`}
              />
            </div>
            <p role="status" className="mt-2 min-h-[1rem] text-center text-[12px] text-brand-text/65">
              {status}
            </p>
          </>
        ) : (
          <p className="mt-auto pt-5 text-[13px] text-brand-text/60">Sizes &amp; pricing coming soon</p>
        )}
      </div>
    </article>
  );
}
