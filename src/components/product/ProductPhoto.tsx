"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { analysePixels, decideFit, FIT_PRESETS, SAFE_DECISION, scaleSizes, type FitAnalysis, type FitDecision, type FitPreset } from "@/lib/storefront/image-fit";

/** Long edge of the tiny rendering used to analyse a photo. */
const SAMPLE_EDGE = 96;

/** Measures a loaded photo: ratio, plus background and product box when the pixels are readable. */
function measure(img: HTMLImageElement): FitAnalysis | null {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return null;
  const base: FitAnalysis = { ratio: w / h };
  try {
    const scale = SAMPLE_EDGE / Math.max(w, h);
    const cw = Math.max(8, Math.round(w * scale));
    const ch = Math.max(8, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return base;
    ctx.drawImage(img, 0, 0, cw, ch);
    return { ...base, ...analysePixels(ctx.getImageData(0, 0, cw, ch).data, cw, ch) };
  } catch {
    // Cross-origin pixels (unreadable): decide from the shape alone.
    return base;
  }
}

/**
 * A product photograph that fits its frame well whatever its shape or
 * background (see src/lib/storefront/image-fit.ts). Fills its positioned
 * parent (the frame), which keeps its own size, radius and background.
 *
 * Until the photo is measured it is shown whole (object-contain), so nothing
 * is ever cropped, even without JavaScript. Works with any admin-uploaded
 * image URL; the alt text is passed through unchanged.
 */
export function ProductPhoto({
  src,
  alt,
  sizes,
  preset = "card",
  priority,
  objectPosition,
  imageClassName = "",
  imageStyle,
  onDecision,
}: {
  src: string;
  alt: string;
  sizes: string;
  preset?: FitPreset;
  priority?: boolean;
  /** Admin focal point; used when the photo fills (covers) the frame. */
  objectPosition?: string;
  /** Extra classes on the <img> (e.g. hover scale). */
  imageClassName?: string;
  imageStyle?: CSSProperties;
  onDecision?: (d: FitDecision) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const analysisRef = useRef<FitAnalysis | null>(null);
  const [decision, setDecision] = useState<FitDecision | null>(null);
  // Hidden only while the browser is about to measure (never in server HTML).
  const [measuring, setMeasuring] = useState(false);

  const apply = useCallback(() => {
    const frame = frameRef.current;
    const analysis = analysisRef.current;
    if (!frame || !analysis) return;
    const { width, height } = frame.getBoundingClientRect();
    if (!width || !height) return;
    const next = decideFit(analysis, width / height, FIT_PRESETS[preset]);
    setDecision((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    setMeasuring(false);
    onDecision?.(next);
  }, [preset, onDecision]);

  const onImage = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img || !img.complete || !img.naturalWidth) return;
      analysisRef.current = measure(img);
      apply();
    },
    [apply],
  );

  // A new photo: measure again.
  useEffect(() => {
    analysisRef.current = null;
    const img = frameRef.current?.querySelector("img");
    if (img?.complete && img.naturalWidth) onImage(img);
    else setMeasuring(true);
    // Safety net: never leave a photo hidden if it fails to load.
    const t = window.setTimeout(() => setMeasuring(false), 4000);
    return () => window.clearTimeout(t);
  }, [src, onImage]);

  // The frame can change shape across breakpoints: re-decide (no re-measuring).
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => apply());
    ro.observe(frame);
    return () => ro.disconnect();
  }, [apply]);

  const d = decision ?? SAFE_DECISION;
  const fit = d.mode === "cover" ? "object-cover" : "object-contain";
  const transform = d.mode === "isolated" && (d.zoom !== 1 || d.translateX || d.translateY) ? `translate(${d.translateX}%, ${d.translateY}%) scale(${d.zoom})` : undefined;

  return (
    <div
      ref={frameRef}
      className="absolute inset-0 overflow-hidden"
      style={{ backgroundColor: d.frameColor }}
      data-photo-fit={decision ? d.mode : "pending"}
    >
      {/* The blend sits on the transformed layer itself: a transform isolates its children from the frame behind. */}
      <div className="absolute inset-0" style={{ transform, mixBlendMode: d.blend ? "multiply" : undefined }}>
        <Image
          src={src}
          alt={alt}
          fill
          // A zoomed product asks for a proportionally larger file, so it stays sharp.
          sizes={d.zoom > 1.1 ? scaleSizes(sizes, Math.min(d.zoom, 2.4)) : sizes}
          priority={priority}
          onLoad={(e) => onImage(e.currentTarget)}
          onError={() => setMeasuring(false)}
          className={`${fit} transition-opacity duration-300 ease-out motion-reduce:transition-none ${measuring ? "opacity-0" : "opacity-100"} ${imageClassName}`}
          style={{
            objectPosition: d.mode === "cover" ? (objectPosition ?? "50% 50%") : "50% 50%",
            ...imageStyle,
          }}
        />
      </div>
    </div>
  );
}
