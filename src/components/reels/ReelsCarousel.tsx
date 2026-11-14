"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface ResolvedReel {
  id: string;
  title: string;
  /** Reel permalink. Absent for placeholders. */
  instagramUrl?: string;
  /** True for "coming soon" cards: decorative, not focusable, no actions. */
  placeholder?: boolean;
  thumbnail?: { src: string; alt: string };
  /** Shop Now (product) or Explore Collection; absent when no confirmed page exists. */
  cta?: { kind: "shop" | "collection"; href: string; label: string };
}

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold";

/** Thumbnail (or neutral placeholder) with the play icon. */
function ReelMedia({ reel }: { reel: ResolvedReel }) {
  return (
    <>
      {reel.thumbnail ? (
        <Image
          src={reel.thumbnail.src}
          alt={reel.thumbnail.alt}
          fill
          sizes="(min-width: 1024px) 180px, (min-width: 640px) 170px, 45vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(110%_80%_at_50%_35%,var(--brand-ivory)_0%,var(--brand-cream)_70%,#eadfcd_100%)]"
        >
          <span className="absolute inset-2.5 rounded-xl border border-brand-gold/30" />
        </span>
      )}
      {reel.thumbnail ? (
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
      ) : null}
      <span
        aria-hidden="true"
        className={`absolute top-1/2 left-1/2 inline-flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white ring-2 ring-white/90 backdrop-blur-[2px] transition-transform duration-300 group-hover:scale-110 ${
          reel.thumbnail ? "bg-black/25" : "bg-brand-gold/45 shadow-[0_6px_16px_-8px_rgba(120,92,40,0.6)]"
        }`}
      >
        <Play className="ml-0.5 size-5 fill-white" strokeWidth={1.5} />
      </span>
    </>
  );
}

function ReelCard({ reel, reserveCta }: { reel: ResolvedReel; reserveCta: boolean }) {
  return (
    <div className="flex h-full flex-col">
      {reel.instagramUrl && !reel.placeholder ? (
        <a
          href={reel.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Watch reel on Instagram: ${reel.title} (opens in a new tab)`}
          className={`group relative block aspect-[9/16] overflow-hidden rounded-2xl bg-brand-cream shadow-[0_14px_28px_-16px_rgba(60,45,20,0.45)] ring-1 ring-brand-gold/25 ${FOCUS}`}
        >
          <ReelMedia reel={reel} />
        </a>
      ) : (
        <div aria-hidden="true" data-reel-placeholder className="group relative block aspect-[9/16] overflow-hidden rounded-2xl bg-brand-cream shadow-[0_14px_28px_-16px_rgba(60,45,20,0.45)] ring-1 ring-brand-gold/25">
          <ReelMedia reel={reel} />
        </div>
      )}

      {reel.cta ? (
        <Link
          href={reel.cta.href}
          className={`mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full border border-brand-gold/70 bg-white/80 px-2 text-[11px] font-semibold tracking-[0.08em] whitespace-nowrap text-brand-black uppercase transition-colors duration-200 hover:border-brand-gold hover:bg-brand-black hover:text-white ${FOCUS}`}
        >
          {reel.cta.label}
          <span className="sr-only">: {reel.title}</span>
          <ArrowRight aria-hidden="true" className="size-3.5" strokeWidth={2} />
        </Link>
      ) : reserveCta ? (
        // Keeps rows aligned when only some Reels have a confirmed destination.
        <span aria-hidden="true" className="mt-3 block h-9" />
      ) : null}
    </div>
  );
}

/** Horizontal Reel carousel: scroll-snap (touch swipe), arrows and page dots. */
export function ReelsCarousel({ reels }: { reels: readonly ResolvedReel[] }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const reserveCta = reels.some((r) => r.cta);

  const update = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth;
    const total = max > 4 ? Math.ceil(track.scrollWidth / track.clientWidth - 0.05) : 1;
    setPages(total);
    setPage(max > 4 ? Math.round((track.scrollLeft / max) * (total - 1)) : 0);
    setCanPrev(track.scrollLeft > 4);
    setCanNext(track.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    update();
    track.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(track);
    return () => {
      track.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  const behavior = (): ScrollBehavior =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  const step = (dir: 1 | -1) => {
    const track = trackRef.current;
    if (track) track.scrollBy({ left: dir * track.clientWidth * 0.9, behavior: behavior() });
  };
  const goTo = (p: number) => {
    const track = trackRef.current;
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth;
    track.scrollTo({ left: pages > 1 ? (max * p) / (pages - 1) : 0, behavior: behavior() });
  };

  const arrow =
    "absolute top-[38%] z-10 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-brand-gold/60 bg-white text-brand-black shadow-[0_6px_18px_-6px_rgba(23,23,23,0.25)] transition-[opacity,background-color] hover:bg-brand-ivory disabled:pointer-events-none disabled:opacity-35 sm:size-12 " +
    FOCUS;

  return (
    <div role="region" aria-roledescription="carousel" aria-label="Luftansa Instagram Reels" className="relative sm:px-8 lg:px-10">
      <ul
        ref={trackRef}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pt-1 pb-3 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:gap-4 sm:px-0 lg:gap-5 [&::-webkit-scrollbar]:hidden"
      >
        {reels.map((reel, i) => (
          <li
            key={reel.id}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${reels.length}`}
            className="w-[calc((100%-0.75rem)/2)] shrink-0 snap-start min-[480px]:w-[calc((100%-1.5rem)/3)] sm:w-[164px] lg:w-[172px] xl:w-[176px]"
          >
            <ReelCard reel={reel} reserveCta={reserveCta} />
          </li>
        ))}
      </ul>

      <button type="button" onClick={() => step(-1)} disabled={!canPrev} aria-label="Previous reels" className={`${arrow} -left-2 sm:left-0`}>
        <ChevronLeft aria-hidden="true" className="size-5" strokeWidth={2} />
      </button>
      <button type="button" onClick={() => step(1)} disabled={!canNext} aria-label="Next reels" className={`${arrow} -right-2 sm:right-0`}>
        <ChevronRight aria-hidden="true" className="size-5" strokeWidth={2} />
      </button>

      {pages > 1 ? (
        <div className="mt-5 flex items-center justify-center gap-1">
          {Array.from({ length: pages }, (_, p) => (
            <button
              key={p}
              type="button"
              onClick={() => goTo(p)}
              aria-label={`Show reels page ${p + 1} of ${pages}`}
              aria-current={p === page ? "true" : undefined}
              className={`group inline-flex size-6 items-center justify-center rounded-full ${FOCUS}`}
            >
              <span
                className={`block size-2.5 rounded-full transition-colors ${
                  p === page ? "bg-brand-black" : "bg-white ring-1 ring-brand-gold/60 group-hover:bg-brand-gold/30"
                }`}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
