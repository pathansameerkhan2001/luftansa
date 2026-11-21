"use client";

import Image from "next/image";
import Link from "next/link";
import { AlertCircle, ArrowRight, ChevronLeft, ChevronRight, Loader2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { revealClass, useReveal } from "@/components/motion/Reveal";
import type { ReelView } from "@/lib/cms/modules/reels";
import { InstagramGlyph } from "./InstagramGlyph";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold";

type Playing = { id: string; mode: "preview" | "user" } | null;
type Status = "idle" | "loading" | "playing" | "paused" | "error";

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Data Saver / slow connection: no hover previews (videos still play on request). */
const saveData = () => {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return Boolean(c?.saveData || (c?.effectiveType && /(^|-)2g$/.test(c.effectiveType)));
};

/**
 * One Reel: poster first; the <video> element is only created when the
 * visitor shows intent (hover preview on desktop, or play), so no video is
 * downloaded until needed. Only one Reel plays at a time (the parent decides),
 * and playback stops when the card leaves the viewport.
 */
function ReelCard({
  reel,
  playing,
  onPlay,
  onStop,
}: {
  reel: ReelView;
  playing: Playing;
  onPlay: (id: string, mode: "preview" | "user") => void;
  onStop: (id: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  /** Pointer is over the card (React can re-fire "enter" when the icon under the cursor changes). */
  const hovering = useRef(false);
  /** After a click on this card, no hover preview until the pointer really leaves. */
  const clicked = useRef(false);
  /** A preview was already requested during this hover. */
  const armed = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [muted, setMuted] = useState(true);
  /** True after the visitor paused: keep the paused frame instead of returning to the poster. */
  const [pausedByUser, setPausedByUser] = useState(false);
  const isActive = playing?.id === reel.id;
  const userPlaying = isActive && playing?.mode === "user";

  // Start / stop the video when this card becomes (in)active.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      v.play().catch(() => {
        // Autoplay refused (e.g. power saving): stay paused, poster visible.
        onStop(reel.id);
      });
    } else if (!v.paused) {
      v.pause();
    }
  }, [isActive, mounted, onStop, reel.id]);

  // Pause when the card scrolls out of view.
  useEffect(() => {
    const el = cardRef.current;
    if (!el || !isActive || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) onStop(reel.id);
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [isActive, onStop, reel.id]);

  // Release the video's network/decoder resources when the card unmounts.
  useEffect(() => {
    const v = videoRef.current;
    return () => {
      window.clearTimeout(hoverTimer.current);
      if (v) {
        v.pause();
        v.removeAttribute("src");
        v.load();
      }
    };
  }, []);

  const requestPlay = (mode: "preview" | "user") => {
    if (status === "error") return;
    setMounted(true);
    if (status === "idle") setStatus("loading");
    onPlay(reel.id, mode);
  };

  const onMediaClick = () => {
    window.clearTimeout(hoverTimer.current); // a click never turns into a hover preview afterwards
    clicked.current = true;
    if (userPlaying) {
      setPausedByUser(true);
      onStop(reel.id);
      return;
    }
    setPausedByUser(false);
    requestPlay("user");
  };

  const onPointerEnter = () => {
    hovering.current = true;
  };
  // Previews start on real mouse movement over the card, never because the page scrolled under a resting cursor.
  const onPointerMove = (e: React.PointerEvent) => {
    if (!hovering.current || armed.current || e.pointerType !== "mouse" || clicked.current || prefersReducedMotion() || saveData() || playing?.mode === "user") return;
    armed.current = true;
    hoverTimer.current = window.setTimeout(() => requestPlay("preview"), 250);
  };
  const onPointerLeave = () => {
    hovering.current = false;
    clicked.current = false;
    armed.current = false;
    window.clearTimeout(hoverTimer.current);
    if (isActive && playing?.mode === "preview") onStop(reel.id);
  };

  const showVideo = mounted && (status === "playing" || (status === "paused" && pausedByUser));
  const label = `${userPlaying ? "Pause" : "Play"} reel: ${reel.title}`;

  return (
    <div ref={cardRef} className="flex h-full flex-col" data-reel={reel.id} data-reel-status={status}>
      <div
        className="group relative aspect-[9/16] overflow-hidden rounded-[22px] bg-brand-cream shadow-[0_18px_36px_-22px_rgba(60,45,20,0.55)] ring-1 ring-brand-gold/25 transition-[box-shadow,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:hover:-translate-y-1 hover:shadow-[0_26px_46px_-24px_rgba(60,45,20,0.6)] motion-reduce:transition-none"
        onPointerEnter={onPointerEnter}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        <Image
          src={reel.poster.src}
          alt={reel.poster.alt}
          fill
          sizes="(min-width: 1280px) 264px, (min-width: 1024px) 250px, (min-width: 640px) 230px, 68vw"
          priority={false}
          loading="lazy"
          className="object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:group-hover:scale-[1.04]"
        />
        {mounted ? (
          <video
            ref={videoRef}
            src={reel.videoSrc}
            poster={reel.poster.src}
            muted={muted}
            loop
            playsInline
            preload="none"
            aria-label={`${reel.title}${reel.caption ? `. ${reel.caption}` : ""}`}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${showVideo ? "opacity-100" : "opacity-0"}`}
            onWaiting={() => setStatus("loading")}
            onPlaying={() => setStatus("playing")}
            onPause={() => setStatus((s) => (s === "error" ? s : "paused"))}
            onError={() => {
              setStatus("error");
              onStop(reel.id);
            }}
          />
        ) : null}

        {/* Soft gradient for legibility of the controls. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />

        {/* Play / pause: the whole media area is the button (large touch target). */}
        <button
          type="button"
          onClick={onMediaClick}
          aria-label={label}
          aria-pressed={userPlaying}
          className={`absolute inset-0 z-10 flex items-center justify-center ${FOCUS} focus-visible:outline-offset-[-4px]`}
          data-reel-play
        >
          <span
            aria-hidden="true"
            className={`inline-flex size-14 items-center justify-center rounded-full bg-black/25 text-white ring-2 ring-white/90 backdrop-blur-[3px] transition-[opacity,transform] duration-300 ease-out motion-safe:group-hover:scale-105 ${
              userPlaying && status === "playing" ? "scale-90 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" : "opacity-100"
            }`}
          >
            {status === "loading" && isActive ? (
              <Loader2 className="size-6 animate-spin motion-reduce:animate-none" strokeWidth={1.75} />
            ) : userPlaying ? (
              <Pause className="size-5 fill-white" strokeWidth={1.5} />
            ) : (
              <Play className="ml-0.5 size-6 fill-white" strokeWidth={1.5} />
            )}
          </span>
        </button>

        {/* Mute / unmute (sound is never turned on automatically). */}
        {mounted && status !== "error" ? (
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? `Unmute reel: ${reel.title}` : `Mute reel: ${reel.title}`}
            aria-pressed={!muted}
            className={`absolute right-3 bottom-3 z-20 inline-flex size-10 items-center justify-center rounded-full bg-black/35 text-white ring-1 ring-white/60 backdrop-blur-sm transition-colors hover:bg-black/55 ${FOCUS}`}
            data-reel-mute
          >
            {muted ? <VolumeX aria-hidden="true" className="size-4.5" strokeWidth={1.75} /> : <Volume2 aria-hidden="true" className="size-4.5" strokeWidth={1.75} />}
          </button>
        ) : null}

        {/* Instagram link. */}
        <a
          href={reel.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Watch "${reel.title}" on Instagram (opens in a new tab)`}
          className={`absolute top-3 right-3 z-20 inline-flex size-10 items-center justify-center rounded-full bg-white/85 shadow-sm ring-1 ring-brand-gold/40 backdrop-blur-sm transition-transform hover:scale-105 motion-reduce:hover:scale-100 ${FOCUS}`}
          data-reel-instagram
        >
          <InstagramGlyph className="size-5" />
        </a>

        {status === "error" ? (
          <div role="status" className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-brand-black/70 px-5 text-center text-white backdrop-blur-[2px]" data-reel-error>
            <AlertCircle aria-hidden="true" className="size-7 text-brand-gold" strokeWidth={1.5} />
            <p className="text-[13px] leading-snug">This video can&apos;t play right now.</p>
            <a
              href={reel.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex h-9 items-center gap-2 rounded-full bg-white px-4 text-[12px] font-semibold text-brand-black ${FOCUS}`}
            >
              <InstagramGlyph className="size-4" /> Watch on Instagram
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
        ) : null}
      </div>

      <div className="mt-3.5 flex flex-1 flex-col px-1">
        {reel.fragranceName ? (
          <p className="text-[10.5px] font-semibold tracking-[0.24em] text-[#8C6D37] uppercase">{reel.fragranceName}</p>
        ) : null}
        <h3 className="mt-1 font-serif text-[18px] leading-snug font-semibold text-balance text-brand-black">{reel.title}</h3>
        {reel.caption ? <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-brand-text/70">{reel.caption}</p> : null}
        {reel.product ? (
          <Link
            href={reel.product.href}
            className={`group/shop mt-3 inline-flex items-center gap-1.5 self-start text-[11.5px] font-semibold tracking-[0.14em] text-brand-black uppercase underline-offset-4 hover:underline ${FOCUS}`}
            data-reel-shop
          >
            Shop {reel.product.name}
            <ArrowRight aria-hidden="true" className="size-3.5 transition-transform group-hover/shop:translate-x-0.5 motion-reduce:transition-none" strokeWidth={2} />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** Horizontal Reel collection: native scroll-snap (touch swipe), arrows and page dots. */
export function ReelsCarousel({ reels }: { reels: readonly ReelView[] }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [playing, setPlaying] = useState<Playing>(null);
  const reveal = useReveal(trackRef, 0.1);

  // A hover preview never replaces a Reel the visitor started themselves.
  const onPlay = useCallback((id: string, mode: "preview" | "user") => setPlaying((p) => (mode === "preview" && p?.mode === "user" ? p : { id, mode })), []);
  const onStop = useCallback((id: string) => setPlaying((p) => (p?.id === id ? null : p)), []);

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

  // Stop playback when the tab is hidden.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setPlaying(null);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const behavior = (): ScrollBehavior => (prefersReducedMotion() ? "auto" : "smooth");
  const step = (dir: 1 | -1) => {
    const track = trackRef.current;
    if (track) track.scrollBy({ left: dir * track.clientWidth * 0.85, behavior: behavior() });
  };
  const goTo = (p: number) => {
    const track = trackRef.current;
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth;
    track.scrollTo({ left: pages > 1 ? (max * p) / (pages - 1) : 0, behavior: behavior() });
  };

  const arrow =
    "absolute top-[36%] z-30 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full border border-brand-gold/60 bg-white/95 text-brand-black shadow-[0_8px_22px_-8px_rgba(23,23,23,0.3)] transition-[opacity,background-color,transform] duration-300 hover:bg-brand-ivory motion-safe:hover:scale-105 disabled:pointer-events-none disabled:opacity-0 sm:inline-flex " +
    FOCUS;

  return (
    <div role="region" aria-roledescription="carousel" aria-label="Luftansa Instagram Reels" className="relative" data-reels-carousel>
      <ul
        ref={trackRef}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto [justify-content:safe_center] overscroll-x-contain px-4 pt-2 pb-4 [scrollbar-width:none] sm:mx-0 sm:scroll-px-1 sm:gap-5 sm:px-1 lg:gap-6 [&::-webkit-scrollbar]:hidden"
      >
        {reels.map((reel, i) => (
          <li
            key={reel.id}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${reels.length}: ${reel.title}`}
            className={`w-[68%] max-w-[280px] shrink-0 snap-start min-[480px]:w-[44%] sm:w-[230px] lg:w-[250px] xl:w-[264px] ${revealClass(reveal)}`}
            style={reveal === "shown" ? { transitionDelay: `${Math.min(i, 6) * 80}ms` } : undefined}
          >
            <ReelCard reel={reel} playing={playing} onPlay={onPlay} onStop={onStop} />
          </li>
        ))}
      </ul>

      <button type="button" onClick={() => step(-1)} disabled={!canPrev} aria-label="Previous reels" className={`${arrow} -left-3 lg:-left-5`}>
        <ChevronLeft aria-hidden="true" className="size-5" strokeWidth={1.75} />
      </button>
      <button type="button" onClick={() => step(1)} disabled={!canNext} aria-label="Next reels" className={`${arrow} -right-3 lg:-right-5`}>
        <ChevronRight aria-hidden="true" className="size-5" strokeWidth={1.75} />
      </button>

      {pages > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-1">
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
                className={`block h-1.5 rounded-full transition-[width,background-color] duration-500 ease-out ${
                  p === page ? "w-6 bg-brand-black" : "w-1.5 bg-brand-gold/50 group-hover:bg-brand-gold"
                }`}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
