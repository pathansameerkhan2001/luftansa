"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

interface ProductCarouselProps {
  /** Accessible name, e.g. "Personality Collection products". */
  label: string;
  children: ReactNode[];
}

/**
 * Horizontal product carousel: native scroll-snap (smooth touch swipe on
 * mobile) plus previous/next arrows that page by one card. Two cards are
 * visible from the `sm` breakpoint, one-and-a-peek on phones.
 */
export function ProductCarousel({ label, children }: ProductCarouselProps) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [arrowTop, setArrowTop] = useState<number | null>(null);

  const update = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth;
    setCanPrev(track.scrollLeft > 4);
    setCanNext(track.scrollLeft < max - 4);

    // Centre the arrows on the product photograph rather than the whole card.
    const media = track.querySelector<HTMLElement>("[data-carousel-media]");
    if (media) {
      const t = track.getBoundingClientRect();
      const m = media.getBoundingClientRect();
      setArrowTop(m.top - t.top + m.height / 2);
    }
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

  const step = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const first = track.firstElementChild as HTMLElement | null;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const distance = first ? first.offsetWidth + gap : track.clientWidth;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: direction * distance, behavior: reduceMotion ? "auto" : "smooth" });
  };

  const arrowClass =
    "absolute z-10 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-brand-gold/50 bg-white text-brand-black shadow-[0_6px_18px_-6px_rgba(23,23,23,0.25)] transition-[opacity,background-color] duration-200 hover:bg-brand-ivory focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold disabled:pointer-events-none disabled:opacity-40 sm:size-12";
  const arrowStyle = { top: arrowTop ?? "38%" };

  return (
    <div role="region" aria-roledescription="carousel" aria-label={label} className="relative">
      <ul
        ref={trackRef}
        className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-smooth px-1 pt-1 pb-3 [scrollbar-width:none] motion-reduce:scroll-auto sm:gap-6 [&::-webkit-scrollbar]:hidden"
      >
        {children.map((child, i) => (
          <li
            key={i}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${children.length}`}
            className="w-[88%] max-w-[360px] shrink-0 snap-start sm:w-[calc((100%-1.5rem)/2)] sm:max-w-none"
          >
            {child}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => step(-1)}
        disabled={!canPrev}
        aria-label="Previous products"
        className={`${arrowClass} -left-3 sm:-left-6`}
        style={arrowStyle}
      >
        <ChevronLeft aria-hidden="true" className="size-5" strokeWidth={2} />
      </button>
      <button
        type="button"
        onClick={() => step(1)}
        disabled={!canNext}
        aria-label="Next products"
        className={`${arrowClass} -right-3 sm:-right-6`}
        style={arrowStyle}
      >
        <ChevronRight aria-hidden="true" className="size-5" strokeWidth={2} />
      </button>
    </div>
  );
}
