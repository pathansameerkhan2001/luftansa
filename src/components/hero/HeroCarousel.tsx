"use client";

import Link from "next/link";
import { ArrowRight, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { HeroImagePanel, type HeroImage } from "./HeroImagePanel";

export interface ResolvedHeroSlide {
  id: string;
  label: string;
  heading: string;
  description: string;
  cta: { text: string; href: string };
  image?: HeroImage;
}

const AUTOPLAY_MS = 7000;
const SWIPE_THRESHOLD_PX = 48;

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia(reducedMotionQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const getReducedMotion = () => window.matchMedia(reducedMotionQuery).matches;
// Server render assumes reduced motion: no autoplay until the client confirms.
const getReducedMotionServer = () => true;

export function HeroCarousel({ slides }: { slides: ResolvedHeroSlide[] }) {
  const count = slides.length;
  const [active, setActive] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    getReducedMotionServer,
  );
  const touchStartX = useRef<number | null>(null);

  const autoplay = count > 1 && !reducedMotion && !userPaused;
  const running = autoplay && !hovering && !focusWithin;

  const goTo = useCallback((i: number) => setActive(((i % count) + count) % count), [count]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") goTo(active + 1);
    }, AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [running, active, goTo]);

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured fragrances"
      className="relative w-full overflow-hidden bg-brand-cream"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") goTo(active + 1);
        if (e.key === "ArrowLeft") goTo(active - 1);
      }}
      onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStartX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(dx) > SWIPE_THRESHOLD_PX) goTo(active + (dx < 0 ? 1 : -1));
      }}
    >
      {/* Slides share one grid cell, so the section takes the tallest slide's height (no jumps). */}
      <div
        className="grid"
        aria-live={running ? "off" : "polite"}
        aria-atomic="false"
      >
        {slides.map((slide, i) => {
          const isActive = i === active;
          const Heading = i === 0 ? "h1" : "h2";
          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={!isActive}
              inert={!isActive}
              className={`relative [grid-area:1/1] transition-opacity duration-[900ms] ease-out motion-reduce:transition-none ${
                isActive ? "z-10 opacity-100" : "z-0 opacity-0"
              }`}
            >
              <div className="flex flex-col lg:block lg:min-h-[560px] xl:min-h-[600px]">
                {/* Text column */}
                <div className="mx-auto flex w-full max-w-7xl px-5 sm:px-8 lg:min-h-[560px] lg:items-center xl:min-h-[600px]">
                  <div
                    className={`w-full py-10 sm:py-14 lg:w-[48%] lg:py-20 lg:pr-12 xl:pr-16 transition-[opacity,transform] duration-[900ms] ease-out motion-reduce:transition-none ${
                      isActive ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                    }`}
                  >
                    <p className="flex items-center gap-4 text-[11px] font-medium uppercase tracking-[0.32em] text-brand-black sm:text-xs">
                      {slide.label}
                      <span aria-hidden="true" className="h-px w-12 bg-brand-gold sm:w-16" />
                    </p>
                    <Heading className="mt-5 font-serif lining-nums text-[40px] leading-[1.05] font-semibold italic tracking-[-0.01em] text-balance text-brand-black min-[400px]:text-[44px] sm:mt-6 sm:text-[56px] lg:text-[60px] xl:text-[72px]">
                      {slide.heading}
                    </Heading>
                    <p className="mt-5 max-w-md text-[15px] leading-relaxed text-pretty text-brand-text/85 sm:mt-6 sm:text-base lg:text-[17px]">
                      {slide.description}
                    </p>
                    <Link
                      href={slide.cta.href}
                      className="group/cta mt-8 inline-flex h-12 w-full items-center justify-center gap-3 rounded-[3px] bg-brand-black px-8 text-[14px] font-medium tracking-[0.04em] text-white transition-colors duration-200 hover:bg-brand-text focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold sm:w-auto sm:min-w-[240px] lg:mt-10"
                    >
                      {slide.cta.text}
                      <ArrowRight
                        aria-hidden="true"
                        className="size-4 transition-transform duration-200 group-hover/cta:translate-x-1 group-hover/cta:text-brand-gold motion-reduce:transition-none"
                        strokeWidth={1.5}
                      />
                    </Link>
                  </div>
                </div>

                {/* Image column: full-bleed to the right edge on desktop */}
                <div className="relative aspect-[4/3] w-full sm:aspect-[16/10] lg:absolute lg:inset-y-0 lg:right-0 lg:aspect-auto lg:w-[52%]">
                  <HeroImagePanel image={slide.image} priority={i === 0} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      {count > 1 && (
        <div className="relative z-20 lg:absolute lg:inset-x-0 lg:bottom-8">
          <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-5 py-4 sm:px-8 lg:w-full lg:justify-start lg:py-0">
            <div className="flex items-center lg:w-[48%]">
              <div className="flex items-center" role="group" aria-label="Choose slide">
                {slides.map((slide, i) => (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={`Show slide ${i + 1}: ${slide.heading}`}
                    aria-current={i === active ? "true" : undefined}
                    className="group/dot inline-flex size-8 items-center justify-center focus-visible:outline-1 focus-visible:outline-brand-gold"
                  >
                    <span
                      className={`block size-2.5 rounded-full border border-brand-black transition-colors duration-300 motion-reduce:transition-none ${
                        i === active ? "bg-brand-black" : "bg-transparent group-hover/dot:bg-brand-gold/60"
                      }`}
                    />
                  </button>
                ))}
              </div>
              {/* Pause control is required for auto-advancing content (WCAG 2.2.2). */}
              {!reducedMotion ? (
                <button
                  type="button"
                  onClick={() => setUserPaused((p) => !p)}
                  aria-label={userPaused ? "Play slideshow" : "Pause slideshow"}
                  className="ml-2 inline-flex size-8 items-center justify-center text-brand-text/70 transition-colors hover:text-brand-black focus-visible:outline-1 focus-visible:outline-brand-gold"
                >
                  {userPaused ? (
                    <Play aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
                  ) : (
                    <Pause aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
                  )}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
