"use client";

import Image from "next/image";
import { Pause, Play } from "lucide-react";
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";

export interface ResolvedHeroImage {
  src: string;
  alt: string;
  position: { base: string; lg?: string };
}

const AUTOPLAY_MS = 8000;

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia(reducedMotionQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const getReducedMotion = () => window.matchMedia(reducedMotionQuery).matches;
// Server render assumes reduced motion: no autoplay until the client confirms.
const getReducedMotionServer = () => true;

/**
 * Image-only hero: crossfading slides when more than one is configured.
 */
export function HeroStage({ slides }: { slides: readonly ResolvedHeroImage[] }) {
  const count = slides.length;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getReducedMotionServer);
  const rotating = count > 1 && !paused && !reducedMotion;

  useEffect(() => {
    if (!rotating) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [rotating, count]);

  return (
    <section
      aria-label="Luftansa Fragrances"
      aria-roledescription={count > 1 ? "carousel" : undefined}
      className="relative w-full bg-brand-cream"
    >
      {/* Height: ~10% taller than before at every breakpoint; fixed boxes, so no layout shift. */}
      <div className="relative aspect-[6/5] w-full overflow-hidden sm:aspect-[8/5] lg:aspect-auto lg:h-[clamp(528px,75vh,748px)]">
        {slides.map((slide, i) => (
          <div
            key={slide.src + i}
            aria-roledescription={count > 1 ? "slide" : undefined}
            aria-label={count > 1 ? `${i + 1} of ${count}` : undefined}
            aria-hidden={i !== active}
            className={`absolute inset-0 transition-opacity duration-[1200ms] ease-in-out motion-reduce:transition-none ${
              i === active ? "opacity-100" : "opacity-0"
            }`}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              priority={i === 0}
              sizes="100vw"
              quality={80}
              className="object-cover [object-position:var(--hero-pos)] lg:[object-position:var(--hero-pos-lg)]"
              style={
                {
                  "--hero-pos": slide.position.base,
                  "--hero-pos-lg": slide.position.lg ?? slide.position.base,
                } as CSSProperties
              }
            />
          </div>
        ))}

        {count > 1 ? (
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Play hero slideshow" : "Pause hero slideshow"}
            className="absolute right-4 bottom-4 z-10 inline-flex size-10 items-center justify-center rounded-full bg-white/80 text-brand-black ring-1 ring-brand-gold/40 backdrop-blur transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
          >
            {paused ? <Play aria-hidden="true" className="size-4" /> : <Pause aria-hidden="true" className="size-4" />}
          </button>
        ) : null}
      </div>
    </section>
  );
}
