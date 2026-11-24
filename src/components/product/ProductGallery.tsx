"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { PerfumeBottleIcon } from "@/components/benefits/BenefitsStrip";
import { ProductPhoto } from "./ProductPhoto";
import type { ProductDetailData } from "./types";

type GalleryImage = ProductDetailData["images"][number];

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold";
/** Photo frame: square on phones/tablets, 4:5 on desktop and never taller than the screen. */
const FRAME = "aspect-square lg:aspect-[4/5] lg:max-h-[calc(100svh-7rem)]";
const ROUND_BTN = `inline-flex items-center justify-center rounded-full border border-brand-gold/50 bg-white/90 text-brand-black shadow-[0_6px_18px_-8px_rgba(23,23,23,0.35)] backdrop-blur-sm transition-colors hover:bg-white ${FOCUS}`;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Product gallery.
 * - Main photograph in a native scroll-snap track: swipe on touch, arrows and
 *   thumbnails on every device, smooth transitions.
 * - Thumbnails: vertical rail on desktop, horizontal row under the photo on
 *   smaller screens.
 * - Zoom: click/tap opens a full-screen viewer (tap to zoom 2x and pan).
 *   There is no automatic hover-magnify: it made photos look over-zoomed.
 * - Each photo is fitted by ProductPhoto: the bottle is made prominent
 *   without cropping it or distorting the photo, whatever its shape.
 * - Frame: square on phones and tablets (keeps the order controls close),
 *   4:5 on desktop, never taller than the screen.
 * Only genuine product photographs are shown; with none, a neutral
 * placeholder is rendered.
 */
export function ProductGallery({ name, images }: Pick<ProductDetailData, "name" | "images">) {
  const [active, setActive] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRailRef = useRef<HTMLDivElement>(null);
  const count = images.length;

  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track || count === 0) return;
      const next = (index + count) % count;
      track.scrollTo({ left: next * track.clientWidth, behavior: prefersReducedMotion() ? "auto" : "smooth" });
      setActive(next);
    },
    [count],
  );

  // Keep the active index in sync with swipes.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || count < 2) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
        setActive((prev) => (prev === i ? prev : Math.min(Math.max(i, 0), count - 1)));
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [count]);

  // Keep the active thumbnail visible in the horizontal rail.
  useEffect(() => {
    const thumb = thumbRailRef.current?.querySelector<HTMLElement>(`[data-thumb="${active}"]`);
    const rail = thumbRailRef.current;
    if (!thumb || !rail || rail.scrollWidth <= rail.clientWidth) return;
    rail.scrollTo({
      left: thumb.offsetLeft - rail.clientWidth / 2 + thumb.offsetWidth / 2,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [active]);

  if (count === 0) {
    return (
      <div className={`relative w-full overflow-hidden rounded-[24px] bg-[radial-gradient(90%_75%_at_50%_40%,#fffdf8_0%,#f3ece0_70%,#eadfcd_100%)] ring-1 ring-brand-gold/25 ${FRAME}`}>
        <div aria-hidden="true" className="absolute inset-4 rounded-[18px] border border-brand-gold/30" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <PerfumeBottleIcon aria-hidden="true" className="size-20 text-brand-gold/60 sm:size-24" strokeWidth={0.6} />
          <p className="mt-4 font-serif text-[26px] leading-tight font-semibold italic text-brand-black sm:text-[30px]">{name}</p>
          <p className="mt-1.5 text-[11px] font-medium tracking-[0.22em] text-brand-text/55 uppercase">Luftansa Fragrance Craft Hub</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row-reverse lg:items-start">
      {/* Main photograph */}
      <div className="relative min-w-0 flex-1">
        <div
          ref={trackRef}
          aria-roledescription="carousel"
          aria-label={`${name} photos`}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-[24px] bg-[radial-gradient(110%_80%_at_50%_40%,#ffffff_0%,var(--brand-ivory)_45%,var(--brand-cream)_100%)] shadow-[0_28px_56px_-36px_rgba(60,45,20,0.5)] ring-1 ring-brand-gold/25 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((img, i) => (
            <div
              key={img.src + i}
              role="group"
              aria-roledescription="slide"
              aria-label={`Photo ${i + 1} of ${count}`}
              aria-hidden={i !== active}
              className={`relative w-full shrink-0 snap-center overflow-hidden ${FRAME}`}
            >
              <button
                type="button"
                tabIndex={i === active ? 0 : -1}
                onClick={() => setViewerOpen(true)}
                aria-label={`Open full-screen view of photo ${i + 1}`}
                className={`absolute inset-0 cursor-zoom-in rounded-[24px] ${FOCUS} focus-visible:-outline-offset-4`}
              >
                <ProductPhoto
                  src={img.src}
                  alt={img.alt}
                  priority={i === 0}
                  sizes="(min-width: 1280px) 640px, (min-width: 1024px) 50vw, (min-width: 640px) 600px, 100vw"
                  preset="gallery"
                  objectPosition={img.objectPosition}
                />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setViewerOpen(true)}
          aria-label="Zoom photo"
          className={`${ROUND_BTN} absolute top-3 right-3 size-10`}
        >
          <Expand aria-hidden="true" className="size-[18px]" strokeWidth={1.6} />
        </button>

        {count > 1 ? (
          <>
            <button type="button" onClick={() => goTo(active - 1)} aria-label="Previous photo" className={`${ROUND_BTN} absolute top-1/2 left-3 size-10 -translate-y-1/2 sm:size-11`}>
              <ChevronLeft aria-hidden="true" className="size-5" strokeWidth={1.8} />
            </button>
            <button type="button" onClick={() => goTo(active + 1)} aria-label="Next photo" className={`${ROUND_BTN} absolute top-1/2 right-3 size-10 -translate-y-1/2 sm:size-11`}>
              <ChevronRight aria-hidden="true" className="size-5" strokeWidth={1.8} />
            </button>
            <p
              aria-live="polite"
              className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/85 px-3 py-1 text-[12px] font-medium text-brand-black tabular-nums ring-1 ring-brand-gold/30 backdrop-blur-sm"
            >
              {active + 1} / {count}
            </p>
          </>
        ) : null}
      </div>

      {/* Thumbnails */}
      {count > 1 ? (
        <div
          ref={thumbRailRef}
          aria-label={`${name} photo thumbnails`}
          role="group"
          className="-mx-1 flex gap-2.5 overflow-x-auto px-1 py-1 [scrollbar-width:none] lg:mx-0 lg:max-h-[calc(100svh-7rem)] lg:w-[88px] lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:overflow-x-visible lg:px-0.5 [&::-webkit-scrollbar]:hidden"
        >
          {images.map((img, i) => (
            <button
              key={img.src + i}
              data-thumb={i}
              type="button"
              aria-label={`Show photo ${i + 1} of ${count}`}
              aria-current={i === active ? "true" : undefined}
              onClick={() => goTo(i)}
              className={`relative aspect-square w-[68px] shrink-0 overflow-hidden rounded-xl bg-white transition-[box-shadow,opacity] sm:w-20 lg:w-full ${FOCUS} ${
                i === active ? "ring-2 ring-brand-black" : "opacity-80 ring-1 ring-brand-gold/30 hover:opacity-100 hover:ring-brand-gold"
              }`}
            >
              <ProductPhoto src={img.src} alt="" sizes="88px" preset="thumb" objectPosition={img.objectPosition} />
            </button>
          ))}
        </div>
      ) : null}

      {viewerOpen ? (
        <ZoomViewer
          name={name}
          images={images}
          index={active}
          onIndexChange={goTo}
          onClose={() => setViewerOpen(false)}
        />
      ) : null}
    </div>
  );
}

/** Full-screen photo viewer (native modal dialog: focus trap and Esc to close). */
function ZoomViewer({
  name,
  images,
  index,
  onIndexChange,
  onClose,
}: {
  name: string;
  images: readonly GalleryImage[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const count = images.length;
  // Never index past the list (e.g. if the photos change while the viewer is open).
  const img = images[Math.min(Math.max(index, 0), count - 1)];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevOverflow;
      if (dialog.open) dialog.close();
    };
  }, []);

  const pointAt = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };

  const step = (delta: number) => {
    setZoom(null);
    onIndexChange(index + delta);
  };

  if (!img) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-label={`${name}: photo ${index + 1} of ${count}`}
      onClose={onClose}
      onKeyDown={(e) => {
        if (count > 1 && e.key === "ArrowRight") step(1);
        if (count > 1 && e.key === "ArrowLeft") step(-1);
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden bg-brand-ivory p-0 backdrop:bg-brand-black/60"
    >
      <div className="relative h-full w-full">
        <div
          className={`relative h-full w-full overflow-hidden ${zoom ? "cursor-zoom-out" : "cursor-zoom-in"}`}
          onPointerUp={(e) => {
            // Read the position now: React clears e.currentTarget once the handler returns, and a
            // state updater may run later (e.g. on a double-click), which crashed the page.
            const point = pointAt(e);
            setZoom((z) => (z ? null : point));
          }}
          onPointerMove={(e) => {
            if (zoom) setZoom(pointAt(e));
          }}
        >
          <Image
            key={img.src}
            src={img.src}
            alt={img.alt}
            fill
            sizes="100vw"
            className="object-contain p-4 transition-transform duration-200 ease-out select-none sm:p-12"
            draggable={false}
            style={{ transform: zoom ? "scale(2.2)" : undefined, transformOrigin: zoom ? `${zoom.x}% ${zoom.y}%` : undefined }}
          />
        </div>

        <button type="button" onClick={onClose} aria-label="Close full-screen view" className={`${ROUND_BTN} absolute top-4 right-4 size-11`}>
          <X aria-hidden="true" className="size-5" strokeWidth={1.8} />
        </button>
        <p className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 text-[12px] font-medium tracking-[0.18em] text-brand-text/60 uppercase">
          {zoom ? "Tap to zoom out" : "Tap to zoom"}
        </p>
        {count > 1 ? (
          <>
            <button type="button" onClick={() => step(-1)} aria-label="Previous photo" className={`${ROUND_BTN} absolute top-1/2 left-4 size-11 -translate-y-1/2`}>
              <ChevronLeft aria-hidden="true" className="size-5" strokeWidth={1.8} />
            </button>
            <button type="button" onClick={() => step(1)} aria-label="Next photo" className={`${ROUND_BTN} absolute top-1/2 right-4 size-11 -translate-y-1/2`}>
              <ChevronRight aria-hidden="true" className="size-5" strokeWidth={1.8} />
            </button>
            <p className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/85 px-3 py-1 text-[12px] font-medium text-brand-black tabular-nums ring-1 ring-brand-gold/30">
              {index + 1} / {count}
            </p>
          </>
        ) : null}
      </div>
    </dialog>
  );
}
