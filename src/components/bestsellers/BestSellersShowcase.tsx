"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MessageCircle, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { PerfumeBottleIcon } from "@/components/benefits/BenefitsStrip";
import { PricePanel, SizePriceCards } from "@/components/pricing/PurchaseControls";
import { ProductPhoto } from "@/components/product/ProductPhoto";
import { formatInr, type ProductOption } from "@/data/products";
import { BUY_NOW_VIA_WHATSAPP, whatsappHref } from "@/data/store";
import { whatsAppOrderHref } from "@/lib/storefront/whatsapp-order";

type NoteTier = "top" | "middle" | "base";

export interface BestSellerItem {
  slug: string;
  name: string;
  /** Product details page, when it exists. */
  href?: string;
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
const NOTE_COLS: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" };

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

  // No online cart yet: ordering goes through WhatsApp with the selection prefilled.
  const knownNotes = item.notes.filter((n): n is typeof n & { name: string } => Boolean(n.name));

  const orderHref =
    selected && BUY_NOW_VIA_WHATSAPP
      ? whatsAppOrderHref({
          productName: item.name,
          productId: item.slug,
          variantId: selected.id,
          variantLabel: selected.label,
          unitPriceInr: selected.priceInr,
          quantity: 1,
        })
      : undefined;

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
        <div className="relative aspect-square overflow-hidden rounded-[24px] bg-[radial-gradient(110%_80%_at_50%_40%,#ffffff_0%,var(--brand-ivory)_45%,var(--brand-cream)_100%)] shadow-[0_24px_48px_-28px_rgba(60,45,20,0.45)] ring-1 ring-brand-gold/25">
          <div
            key={item.slug}
            aria-roledescription="slide"
            aria-label={`${activeIndex + 1} of ${items.length}: ${item.name}`}
            className="absolute inset-0 transition-opacity duration-500 ease-out motion-reduce:transition-none starting:opacity-0"
          >
            {item.image ? (
              <ProductPhoto
                src={item.image.src}
                alt={item.image.alt}
                sizes="(min-width: 1280px) 34vw, (min-width: 768px) 45vw, 92vw"
                preset="showcase"
                objectPosition={item.image.objectPosition}
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(90%_75%_at_50%_40%,#fffdf8_0%,#f3ece0_70%,#eadfcd_100%)]">
                <div aria-hidden="true" className="absolute inset-4 rounded-[18px] border border-brand-gold/30" />
                <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
                  <PerfumeBottleIcon aria-hidden="true" className="size-20 text-brand-gold/60 sm:size-24" strokeWidth={0.6} />
                  <p className="mt-4 font-serif text-[23px] leading-tight font-semibold italic text-brand-black sm:text-[26px]">
                    {item.name}
                  </p>
                  <p className="mt-1 text-[11px] font-medium tracking-[0.22em] text-brand-text/55 uppercase">Luftansa Fragrance Craft Hub</p>
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
        {item.href ? (
          <Link
            href={item.href}
            className="mt-2.5 inline-flex items-center gap-1 text-[12.5px] font-semibold tracking-[0.06em] text-brand-black underline decoration-brand-gold/70 underline-offset-4 hover:decoration-brand-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
          >
            View full details
            <span className="sr-only">: {item.name}</span>
          </Link>
        ) : null}
        {/* Only confirmed details are shown; anything not set is simply left out. */}
        {item.perfectFor ? (
          <p className={`mt-3 text-[14.5px] font-semibold ${ACCENT_TEXT} sm:text-[15px]`}>
            Perfect for: <span className="font-normal text-brand-text/85">{item.perfectFor}</span>
          </p>
        ) : null}
        {item.description ? (
          <p className="mt-1.5 text-[14px] leading-relaxed text-pretty text-brand-text/85 sm:text-[14.5px]">{item.description}</p>
        ) : null}

        {knownNotes.length ? (
          <>
        <hr className="my-4 border-brand-gold/30" />

        <ul className={`grid divide-x divide-brand-gold/30 ${NOTE_COLS[knownNotes.length] ?? "grid-cols-3"}`} aria-label="Scent notes">
          {knownNotes.map((note) => (
            <li key={note.tier} className="flex flex-col items-center px-1 text-center">
              <span className="relative inline-flex size-12 items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_6px_14px_-8px_rgba(60,45,20,0.5)] ring-1 ring-brand-gold/30 sm:size-14">
                {note.image ? (
                  <Image src={note.image.src} alt={note.image.alt} fill sizes="56px" className="object-cover" />
                ) : (
                  <Sparkles aria-hidden="true" className="size-5 text-brand-gold/70" strokeWidth={1.25} />
                )}
              </span>
              <span className="mt-2 text-[11.5px] text-brand-text/70 sm:text-[12px]">{TIER_LABEL[note.tier]}</span>
              <span className="mt-0.5 text-[14px] font-semibold text-brand-black sm:text-[14.5px]">{note.name}</span>
            </li>
          ))}
        </ul>
          </>
        ) : null}

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
            <PricePanel option={selected} productName={item.name} size="feature" />
          </div>
        ) : null}

        <div className="mt-3">
          {orderHref && selected ? (
            <a
              href={orderHref}
              target="_blank"
              rel="noopener noreferrer"
              data-whatsapp-order
              className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-full bg-brand-black text-[15px] font-semibold tracking-[0.02em] text-white transition-colors duration-200 hover:bg-brand-text focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold"
            >
              <MessageCircle aria-hidden="true" className="size-5" strokeWidth={1.5} />
              Order on WhatsApp
              <span className="sr-only">
                : {item.name}, {selected.label}, {formatInr(selected.priceInr)} (opens WhatsApp in a new tab)
              </span>
            </a>
          ) : (
            <a
              href={whatsappHref(`Hello Luftansa, I would like to know more about ${item.name}.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-full border border-brand-black text-[15px] font-semibold text-brand-black transition-colors hover:bg-brand-black hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold"
            >
              <MessageCircle aria-hidden="true" className="size-5" strokeWidth={1.5} />
              Ask us on WhatsApp<span className="sr-only">: {item.name} (opens WhatsApp in a new tab)</span>
            </a>
          )}
        </div>
        <p role="status" className="mt-2 min-h-[1.25rem] text-[12.5px] text-brand-text/70">
          {status}
        </p>
      </div>
    </div>
  );
}
