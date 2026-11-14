"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { PerfumeBottleIcon } from "@/components/benefits/BenefitsStrip";
import { AddToCartButton, PricePanel, SizePriceCards } from "@/components/pricing/PurchaseControls";
import { formatInr, type ProductOption } from "@/data/products";
import { dispatchAddToCart, dispatchWishlist } from "@/lib/cart-events";

type NoteTier = "top" | "middle" | "base";

export interface BestSellerItem {
  slug: string;
  name: string;
  options: readonly ProductOption[];
  image?: { src: string; alt: string; objectPosition?: string };
  perfectFor?: string;
  description?: string;
  /** Confirmed oil concentration (shown only when set). */
  concentration?: string;
  /** Confirmed gender positioning, e.g. "Unisex" (shown only when set). */
  gender?: string;
  notes: readonly { tier: NoteTier; name?: string; image?: { src: string; alt: string } }[];
}

const TIER_LABEL: Record<NoteTier, string> = { top: "Top Note", middle: "Middle Note", base: "Base Note" };
const DARK = "bg-[#1c1712]";
const ACCENT_TEXT = "text-[#7a5a2b]";

/* ---------------------------------------------------------------- bottle --- */

interface BottleProps {
  item: BestSellerItem;
  sizeLabel?: string;
  active: boolean;
  index: number;
  onSelect: () => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
}

/** Miniature perfume bottle used as a radio selector. Label shows name + size. */
function BottleSelector({ item, sizeLabel, active, index, onSelect, buttonRef }: BottleProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      role="radio"
      aria-checked={active}
      tabIndex={active ? 0 : -1}
      onClick={onSelect}
      aria-label={`${item.name}${sizeLabel ? `, ${sizeLabel}` : ""}`}
      data-bottle-index={index}
      className="group flex h-[230px] w-[64px] shrink-0 flex-col items-center outline-none md:h-[260px] md:w-[70px] lg:h-[330px] lg:w-[54px] xl:h-[430px] xl:w-[68px]"
    >
      {/* Cap */}
      <span
        aria-hidden="true"
        className="relative h-[13%] w-[50%] rounded-t-[7px] rounded-b-[3px] bg-[linear-gradient(90deg,#e9e6df_0%,#ffffff_35%,#fbfaf7_60%,#dcd8cf_100%)] shadow-[0_2px_4px_rgba(23,23,23,0.12)]"
      >
        <span className="absolute inset-y-[12%] left-[22%] w-[10%] rounded-full bg-white/90" />
      </span>
      {/* Collar */}
      <span
        aria-hidden="true"
        className="h-[3%] w-[62%] rounded-[2px] bg-[linear-gradient(90deg,#d9d4c8,#f4f1ea,#d0cabd)]"
      />
      {/* Body */}
      <span
        className={`relative flex w-full flex-1 rounded-[12px] bg-[linear-gradient(90deg,#f1ede4_0%,#ffffff_30%,#fdfbf6_70%,#ebe6db_100%)] p-[11%] shadow-[0_14px_24px_-12px_rgba(60,45,20,0.35),0_2px_4px_rgba(60,45,20,0.08)] ring-1 transition-[box-shadow,transform] duration-300 group-hover:-translate-y-0.5 group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-brand-gold ${
          active ? "ring-brand-gold" : "ring-brand-gold/35"
        }`}
      >
        {/* Label */}
        <span
          className={`flex w-full flex-col items-center justify-between rounded-[8px] px-0.5 py-[14%] transition-colors duration-300 ${
            active
              ? `${DARK} text-white ring-2 ring-brand-gold`
              : "bg-brand-ivory text-brand-black ring-1 ring-brand-gold/30"
          }`}
        >
          <span className="flex flex-1 items-center justify-center overflow-hidden">
            <span className="text-[11px] leading-none font-bold tracking-[0.08em] whitespace-nowrap uppercase [writing-mode:vertical-rl] md:text-[12px] lg:text-[11px] xl:text-[13px]">
              {item.name}
            </span>
          </span>
          {sizeLabel ? (
            <span className="mt-2 flex w-full flex-col items-center">
              <span
                aria-hidden="true"
                className={`mb-1.5 h-px w-[60%] ${active ? "bg-brand-gold/80" : "bg-brand-gold/50"}`}
              />
              <span className="text-[9px] leading-none font-semibold tracking-[0.04em] whitespace-nowrap uppercase xl:text-[10px]">
                {sizeLabel}
              </span>
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

/* -------------------------------------------------------------- showcase --- */

export function BestSellersShowcase({ items }: { items: readonly BestSellerItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  // Remember each fragrance's chosen size; default to its largest confirmed size.
  const [sizeBySlug, setSizeBySlug] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.slug, i.options[i.options.length - 1]?.id ?? ""])),
  );
  const [status, setStatus] = useState("");
  const bottleRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rowRef = useRef<HTMLDivElement>(null);

  const item = items[activeIndex];
  const selected = item.options.find((o) => o.id === sizeBySlug[item.slug]) ?? item.options[0];

  const select = useCallback(
    (index: number, focus = false) => {
      const next = (index + items.length) % items.length;
      setActiveIndex(next);
      setStatus("");
      if (focus) bottleRefs.current[next]?.focus({ preventScroll: true });
    },
    [items.length],
  );

  // On the mobile scroll row, keep the active bottle in view without moving the page.
  useEffect(() => {
    const row = rowRef.current;
    const bottle = bottleRefs.current[activeIndex];
    if (!row || !bottle || row.scrollWidth <= row.clientWidth) return;
    const target = bottle.offsetLeft - (row.clientWidth - bottle.offsetWidth) / 2;
    row.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [activeIndex]);

  const onBottleKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (delta) {
      e.preventDefault();
      select(activeIndex + delta, true);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      select(e.key === "Home" ? 0 : items.length - 1, true);
    }
  };

  const addToCart = () => {
    if (!selected) return;
    dispatchAddToCart({
      slug: item.slug,
      name: item.name,
      optionId: selected.id,
      optionLabel: selected.label,
      priceInr: selected.priceInr,
    });
    setStatus(`Online ordering is coming soon. Your selection: ${item.name}, ${selected.label}.`);
  };

  const wishlist = () => {
    dispatchWishlist({ slug: item.slug, name: item.name });
    setStatus("Wishlist is coming soon.");
  };

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-x-8 md:gap-y-10 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-x-8 xl:grid-cols-[auto_minmax(0,1.1fr)_minmax(0,1fr)] xl:gap-x-10">
      {/* Bottle selectors */}
      <div
        ref={rowRef}
        role="radiogroup"
        aria-label="Choose a fragrance"
        onKeyDown={onBottleKeys}
        className="-mx-4 flex gap-3 overflow-x-auto px-4 pt-1 pb-4 [scrollbar-width:none] md:col-span-2 md:mx-0 md:justify-center md:gap-5 md:overflow-visible md:px-0 lg:col-span-1 lg:gap-3 xl:gap-3.5 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((it, i) => (
          <BottleSelector
            key={it.slug}
            item={it}
            index={i}
            active={i === activeIndex}
            sizeLabel={it.options.find((o) => o.id === sizeBySlug[it.slug])?.label}
            onSelect={() => select(i)}
            buttonRef={(el) => {
              bottleRefs.current[i] = el;
            }}
          />
        ))}
      </div>

      {/* Showcase image */}
      <div
        role="group"
        aria-roledescription="carousel"
        aria-label="Best seller showcase"
        className="relative mx-auto w-full max-w-[560px] md:max-w-none"
      >
        <div className="relative aspect-square overflow-hidden rounded-[24px] bg-brand-cream shadow-[0_24px_48px_-28px_rgba(60,45,20,0.45)] ring-1 ring-brand-gold/25">
          <div
            key={item.slug}
            aria-roledescription="slide"
            aria-label={`${activeIndex + 1} of ${items.length}: ${item.name}`}
            className="absolute inset-0 transition-opacity duration-500 ease-out motion-reduce:transition-none starting:opacity-0"
          >
            {item.image ? (
              <Image
                src={item.image.src}
                alt={item.image.alt}
                fill
                sizes="(min-width: 1280px) 34vw, (min-width: 768px) 45vw, 92vw"
                className="object-cover"
                style={{ objectPosition: item.image.objectPosition ?? "50% 50%" }}
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(90%_75%_at_50%_40%,#fffdf8_0%,#f3ece0_70%,#eadfcd_100%)]">
                <div aria-hidden="true" className="absolute inset-4 rounded-[18px] border border-brand-gold/30" />
                <span className="absolute top-7 left-1/2 -translate-x-1/2 rounded-full border border-brand-gold/50 bg-white/70 px-3 py-1 text-[10.5px] font-medium tracking-[0.14em] whitespace-nowrap text-brand-text/70 uppercase">
                  Temporary placeholder
                </span>
                <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
                  <PerfumeBottleIcon aria-hidden="true" className="size-20 text-brand-gold/60 sm:size-24" strokeWidth={0.6} />
                  <p className="mt-4 font-serif text-[23px] leading-tight font-semibold italic text-brand-black sm:text-[26px]">
                    {item.name}
                  </p>
                  <p className="mt-1 text-[13px] text-brand-text/65">Product photograph coming soon</p>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => select(activeIndex - 1)}
            aria-label="Previous fragrance"
            className="absolute top-1/2 left-3 z-10 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-brand-black shadow-[0_6px_18px_-6px_rgba(23,23,23,0.3)] ring-1 ring-brand-gold/30 transition-colors hover:bg-brand-ivory focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold sm:left-4 sm:size-12"
          >
            <ChevronLeft aria-hidden="true" className="size-5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => select(activeIndex + 1)}
            aria-label="Next fragrance"
            className="absolute top-1/2 right-3 z-10 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-brand-black shadow-[0_6px_18px_-6px_rgba(23,23,23,0.3)] ring-1 ring-brand-gold/30 transition-colors hover:bg-brand-ivory focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold sm:right-4 sm:size-12"
          >
            <ChevronRight aria-hidden="true" className="size-5" strokeWidth={2} />
          </button>

          <div className="absolute inset-x-0 bottom-4 z-10 flex justify-center gap-1">
            {items.map((it, i) => (
              <button
                key={it.slug}
                type="button"
                onClick={() => select(i)}
                aria-label={`Show ${it.name}`}
                aria-current={i === activeIndex ? "true" : undefined}
                className="group inline-flex size-6 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-brand-gold"
              >
                <span
                  className={`block size-2.5 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-colors ${
                    i === activeIndex ? "bg-brand-gold" : "bg-white group-hover:bg-brand-ivory"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="min-w-0">
        <h3 className="font-serif text-[30px] leading-none font-semibold tracking-[0.03em] text-brand-black uppercase sm:text-[34px] xl:text-[38px]">
          {item.name}
        </h3>
        {/* Bottle size + confirmed product facts. */}
        <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Product details">
          {[selected ? `${selected.label} bottle` : undefined, item.concentration, item.gender]
            .filter((v): v is string => Boolean(v))
            .map((fact) => (
              <li
                key={fact}
                className="rounded-full border border-brand-gold/45 bg-white/70 px-2.5 py-0.5 text-[11.5px] font-medium text-brand-text"
              >
                {fact}
              </li>
            ))}
        </ul>
        <p className={`mt-3 text-[14.5px] font-semibold ${ACCENT_TEXT} sm:text-[15px]`}>
          Perfect for:{" "}
          {item.perfectFor ?? <span className="font-normal text-brand-text/55 italic">details coming soon</span>}
        </p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-pretty text-brand-text/85 sm:text-[14.5px]">
          {item.description ?? (
            <span className="text-brand-text/55 italic">
              Fragrance description coming soon. Notes and occasion will appear here once confirmed.
            </span>
          )}
        </p>

        <hr className="my-4 border-brand-gold/30" />

        <ul className="grid grid-cols-3 divide-x divide-brand-gold/30" aria-label="Scent notes">
          {item.notes.map((note) => (
            <li key={note.tier} className="flex flex-col items-center px-1 text-center">
              <span className="relative inline-flex size-12 items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_6px_14px_-8px_rgba(60,45,20,0.5)] ring-1 ring-brand-gold/30 sm:size-14">
                {note.image ? (
                  <Image src={note.image.src} alt={note.image.alt} fill sizes="56px" className="object-cover" />
                ) : (
                  <Sparkles aria-hidden="true" className="size-5 text-brand-gold/70" strokeWidth={1.25} />
                )}
              </span>
              <span className="mt-2 text-[11.5px] text-brand-text/70 sm:text-[12px]">{TIER_LABEL[note.tier]}</span>
              <span className="mt-0.5 text-[14px] font-semibold text-brand-black sm:text-[14.5px]">
                {note.name ?? <span className="text-[12px] font-normal text-brand-text/50 italic">Coming soon</span>}
              </span>
            </li>
          ))}
        </ul>

        <hr className="my-4 border-brand-gold/30" />

        <p id="best-seller-size-label" className={`text-[14.5px] font-semibold ${ACCENT_TEXT} sm:text-[15px]`}>
          Select Size
        </p>
        <div className="mt-2.5" data-size-cards>
          <SizePriceCards
            options={item.options}
            selectedId={selected?.id}
            onSelect={(id) => {
              setSizeBySlug((s) => ({ ...s, [item.slug]: id }));
              setStatus("");
            }}
            label={`Select a size for ${item.name}`}
          />
        </div>

        {selected ? (
          <div className="mt-4">
            <PricePanel option={selected} productName={item.name} onWishlist={wishlist} size="feature" />
          </div>
        ) : null}

        <div className="mt-3">
          <AddToCartButton
            onClick={addToCart}
            disabled={!selected}
            shape="feature"
            srDetail={selected ? `${item.name}, ${selected.label}, ${formatInr(selected.priceInr)}` : undefined}
          />
        </div>
        <p role="status" className="mt-2 min-h-[1.25rem] text-[12.5px] text-brand-text/70">
          {status}
        </p>
      </div>
    </div>
  );
}
