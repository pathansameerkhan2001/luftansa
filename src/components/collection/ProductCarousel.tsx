"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

interface ProductCarouselProps {
  /** Accessible name, e.g. "Personality Collection products". */
  label: string;
  children: ReactNode[];
}

/**
 * Horizontal product carousel, one per collection panel (each keeps its own
 * state, so one panel's controls never move the other). Native scroll-snap
 * gives smooth touch swipe; previous/next arrows and pagination dots page by
 * one card. Two cards are visible from the `sm` breakpoint, one with a peek of
 * the next on phones. Cards are centred when they all fit, and the controls
 * are then hidden. No animation library; reduced motion jumps instead of
 * gliding.
 */
export function ProductCarousel({ label, children }: ProductCarouselProps) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(0);
  const [arrowTop, setArrowTop] = useState<number | null>(null);

  /** Distance between two neighbouring cards (card width + gap). */
  const stepSize = useCallback(() => {
    const track = trackRef.current;
    const first = track?.firstElementChild as HTMLElement | null;
    if (!track || !first) return 0;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    return first.offsetWidth + gap;
  }, []);

  const update = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth;
    const step = stepSize();
    const count = max > 4 && step > 0 ? Math.round(max / step) + 1 : 1;
    setPages(count);
    setPage(count > 1 ? Math.min(count - 1, Math.round(track.scrollLeft / step)) : 0);

    // Centre the arrows on the product photograph rather than the whole card.
    const media = track.querySelector<HTMLElement>("[data-carousel-media]");
    if (media) {
      const t = track.getBoundingClientRect();
      const m = media.getBoundingClientRect();
      setArrowTop(m.top - t.top + m.height / 2);
    }
  }, [stepSize]);

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

  const goTo = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = Math.max(0, Math.min(pages - 1, index));
    track.scrollTo({ left: target * stepSize(), behavior: reduceMotion ? "auto" : "smooth" });
  };

  const scrollable = pages > 1;
  const arrowClass =
    "absolute z-10 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-brand-gold/40 bg-white text-brand-black shadow-[0_8px_20px_-8px_rgba(23,23,23,0.35)] transition-[opacity,background-color,transform] duration-200 hover:bg-brand-ivory active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold disabled:pointer-events-none disabled:opacity-35 motion-reduce:transition-none sm:size-12";
  const arrowStyle = { top: arrowTop ?? "38%" };

  return (
    <div role="region" aria-roledescription="carousel" aria-label={label} className="relative" data-carousel>
      <ul
        ref={trackRef}
        className="-mx-1 flex snap-x snap-mandatory scroll-px-1 gap-4 overflow-x-auto overscroll-x-contain px-1 pt-1 pb-2 [justify-content:safe_center] [scrollbar-width:none] sm:gap-5 2xl:gap-6 [&::-webkit-scrollbar]:hidden"
        data-carousel-track
      >
        {children.map((child, i) => (
          <li
            key={i}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${children.length}`}
            className="w-[82%] max-w-[340px] shrink-0 snap-start sm:w-[calc((100%-1.25rem)/2)] sm:max-w-none 2xl:w-[calc((100%-1.5rem)/2)]"
          >
            {child}
          </li>
        ))}
      </ul>

      {scrollable ? (
        <>
          <button type="button" onClick={() => goTo(page - 1)} disabled={page === 0} aria-label="Previous products" className={`${arrowClass} -left-2 sm:-left-5`} style={arrowStyle} data-carousel-prev>
            <ChevronLeft aria-hidden="true" className="size-5" strokeWidth={2.25} />
          </button>
          <button type="button" onClick={() => goTo(page + 1)} disabled={page >= pages - 1} aria-label="Next products" className={`${arrowClass} -right-2 sm:-right-5`} style={arrowStyle} data-carousel-next>
            <ChevronRight aria-hidden="true" className="size-5" strokeWidth={2.25} />
          </button>
          <div className="mt-3 flex justify-center" data-carousel-dots>
            {Array.from({ length: pages }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to position ${i + 1} of ${pages}`}
                aria-current={i === page ? "true" : undefined}
                className="group/dot inline-flex size-7 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-gold"
              >
                <span
                  aria-hidden="true"
                  className={`block size-2.5 rounded-full border border-brand-gold transition-colors duration-300 motion-reduce:transition-none ${i === page ? "bg-brand-gold" : "bg-transparent group-hover/dot:bg-brand-gold/30"}`}
                />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
