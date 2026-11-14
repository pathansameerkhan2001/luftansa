"use client";

import Image from "next/image";
import { useRef, useState, type KeyboardEvent } from "react";
import { PerfumeBottleIcon } from "@/components/benefits/BenefitsStrip";
import type { ProductDetailData } from "./types";

/**
 * Product gallery: large main photograph with vertical thumbnails (desktop) or
 * a thumbnail row (mobile). Only genuine S3 photographs are shown; without any,
 * a clearly labelled temporary placeholder is rendered instead.
 */
export function ProductGallery({ name, images }: Pick<ProductDetailData, "name" | "images">) {
  const [active, setActive] = useState(0);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = images[active];

  const onThumbKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!delta) return;
    e.preventDefault();
    const next = (active + delta + images.length) % images.length;
    setActive(next);
    thumbRefs.current[next]?.focus();
  };

  return (
    <div className="flex flex-col-reverse gap-3 sm:gap-4 lg:flex-row lg:items-start">
      {images.length > 1 ? (
        <div
          role="tablist"
          aria-label={`${name} photos`}
          aria-orientation="vertical"
          onKeyDown={onThumbKeys}
          className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] lg:w-[92px] lg:shrink-0 lg:flex-col lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden"
        >
          {images.map((img, i) => (
            <button
              key={img.src + i}
              ref={(el) => {
                thumbRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-controls="product-main-photo"
              aria-label={`Show photo ${i + 1} of ${images.length}`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
              className={`relative aspect-square w-[72px] shrink-0 overflow-hidden rounded-xl bg-brand-cream transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold sm:w-20 lg:w-full ${
                i === active ? "ring-2 ring-brand-black" : "ring-1 ring-brand-gold/30 hover:ring-brand-gold"
              }`}
            >
              <Image src={img.src} alt="" fill sizes="92px" className="object-cover" style={{ objectPosition: img.objectPosition }} />
            </button>
          ))}
        </div>
      ) : null}

      <div
        id="product-main-photo"
        role={images.length > 1 ? "tabpanel" : undefined}
        className="relative aspect-[4/5] w-full overflow-hidden rounded-[24px] bg-brand-cream shadow-[0_28px_56px_-36px_rgba(60,45,20,0.5)] ring-1 ring-brand-gold/25"
      >
        {current ? (
          <Image
            key={current.src}
            src={current.src}
            alt={current.alt}
            fill
            priority
            sizes="(min-width: 1024px) 46vw, 100vw"
            className="object-cover transition-opacity duration-500 starting:opacity-0"
            style={{ objectPosition: current.objectPosition ?? "50% 50%" }}
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(90%_75%_at_50%_40%,#fffdf8_0%,#f3ece0_70%,#eadfcd_100%)]">
            <div aria-hidden="true" className="absolute inset-4 rounded-[18px] border border-brand-gold/30" />
            <span className="absolute top-7 left-1/2 -translate-x-1/2 rounded-full border border-brand-gold/50 bg-white/70 px-3 py-1 text-[10.5px] font-medium tracking-[0.14em] whitespace-nowrap text-brand-text/70 uppercase">
              Temporary placeholder
            </span>
            <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
              <PerfumeBottleIcon aria-hidden="true" className="size-20 text-brand-gold/60 sm:size-24" strokeWidth={0.6} />
              <p className="mt-4 font-serif text-[24px] leading-tight font-semibold italic text-brand-black sm:text-[28px]">{name}</p>
              <p className="mt-1 text-[13px] text-brand-text/65">Product photograph coming soon</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
