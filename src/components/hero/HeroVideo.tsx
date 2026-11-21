"use client";

import { Pause, Play } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { MOBILE_MEDIA_QUERY } from "@/lib/cms/fields";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function useMediaQuery(query: string): boolean | null {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    // Server and hydration: unknown, so no video is rendered until the client decides.
    () => null,
  );
}

/**
 * Optional muted background video over the hero image.
 *
 * - The source is chosen in the browser by screen width, so a phone never
 *   downloads the desktop video (and gets no video when none is set for it).
 * - Nothing plays for visitors who prefer reduced motion.
 * - The image underneath stays visible until the first frame is ready, and
 *   remains if the video fails, so there is no blank hero and no layout shift.
 * - A pause control is provided for the looping motion (WCAG 2.2.2).
 */
export function HeroVideo({
  desktopSrc,
  mobileSrc,
  desktopPosition,
  mobilePosition,
}: {
  desktopSrc?: string;
  mobileSrc?: string;
  desktopPosition: string;
  mobilePosition: string;
}) {
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);
  const reducedMotion = useMediaQuery(REDUCED_MOTION);
  const [readySrc, setReadySrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  if (isMobile === null || reducedMotion !== false) return null;
  const src = isMobile ? mobileSrc : desktopSrc;
  if (!src || failedSrc === src) return null;
  const ready = readySrc === src;

  return (
    <>
      <video
        key={src}
        ref={(el) => {
          if (!el) return;
          if (paused && !el.paused) el.pause();
          if (!paused && el.paused && ready) void el.play().catch(() => undefined);
        }}
        src={src}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        tabIndex={-1}
        data-hero-video={isMobile ? "mobile" : "desktop"}
        onLoadedData={() => setReadySrc(src)}
        onError={() => setFailedSrc(src)}
        className={`absolute inset-0 size-full object-cover transition-opacity duration-700 motion-reduce:transition-none ${ready ? "opacity-100" : "opacity-0"}`}
        style={{ objectPosition: isMobile ? mobilePosition : desktopPosition }}
      />
      {ready ? (
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Play background video" : "Pause background video"}
          className="absolute right-4 bottom-4 z-20 inline-flex size-10 items-center justify-center rounded-full bg-white/80 text-brand-black ring-1 ring-brand-gold/40 backdrop-blur transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
        >
          {paused ? <Play aria-hidden="true" className="size-4" /> : <Pause aria-hidden="true" className="size-4" />}
        </button>
      ) : null}
    </>
  );
}
