"use client";

import Image from "next/image";
import { useEffect, useState, type CSSProperties } from "react";
import styles from "./HeroFlourish.module.css";

/**
 * Decorative hummingbird + flower flourish built ONLY from the original
 * Luftansa logo image (1183×1600). The artwork is never redrawn or edited:
 * the same image is shown twice through clip-path masks, one exposing the
 * hummingbird and one exposing the flowers, so they can move independently.
 * When the animation ends both layers sit in their original positions and
 * together reproduce the original artwork exactly.
 *
 * Source coordinates (px in the original image) were measured from the file:
 *   artwork window    x 220–1045, y 225–975
 *   hummingbird mask  body/wings right of the middle flower + a narrow band
 *                     around the beak where it meets the flower
 */
const SOURCE = { width: 1183, height: 1600 } as const;
const WINDOW = { x: 220, y: 225, width: 825, height: 750 } as const;

const BIRD_POLYGON: readonly (readonly [number, number])[] = [
  [700, 495], [1045, 495], [1045, 975], [652, 975], [652, 618],
  [560, 596], [560, 566], [652, 580], [700, 572],
];

/** Centre of the middle flower, where the hummingbird feeds. */
const FLOWER_CENTRE = { x: 540, y: 560 } as const;

const pct = (n: number) => `${(n * 100).toFixed(3)}%`;
const toWindow = ([x, y]: readonly [number, number]) =>
  `${pct((x - WINDOW.x) / WINDOW.width)} ${pct((y - WINDOW.y) / WINDOW.height)}`;

const birdPoints = BIRD_POLYGON.map(toWindow);
const BIRD_CLIP = `polygon(${birdPoints.join(", ")})`;
// Everything except the hummingbird: outer rectangle with the bird cut out (even-odd).
const FLOWER_CLIP = `polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${birdPoints.join(", ")}, ${birdPoints[0]}, 0% 0%)`;

const imageStyle: CSSProperties = {
  position: "absolute",
  width: pct(SOURCE.width / WINDOW.width),
  height: pct(SOURCE.height / WINDOW.height),
  left: pct(-WINDOW.x / WINDOW.width),
  top: pct(-WINDOW.y / WINDOW.height),
  maxWidth: "none",
};

/** Entrance variants: each slide replays the flourish with different timing/path. */
const VARIANTS: readonly Record<string, string>[] = [
  { "--bloom-delay": "0.15s", "--bloom-dur": "1.1s", "--flight-delay": "0.7s", "--flight-dur": "2.1s", "--from-x": "46%", "--from-y": "-18%", "--from-r": "7deg" },
  { "--bloom-delay": "0.05s", "--bloom-dur": "0.9s", "--flight-delay": "0.5s", "--flight-dur": "2.5s", "--from-x": "36%", "--from-y": "-42%", "--from-r": "12deg" },
  { "--bloom-delay": "0.25s", "--bloom-dur": "1.3s", "--flight-delay": "0.9s", "--flight-dur": "1.9s", "--from-x": "55%", "--from-y": "8%", "--from-r": "3deg" },
];

function ArtworkLayer({ src, clip, onLoad }: { src: string; clip: string; onLoad: () => void }) {
  return (
    <span className="absolute inset-0 block overflow-hidden" style={{ clipPath: clip }}>
      <Image
        src={src}
        alt=""
        width={SOURCE.width}
        height={SOURCE.height}
        sizes="(min-width: 1024px) 340px, (min-width: 640px) 240px, 170px"
        loading="eager"
        onLoad={onLoad}
        style={imageStyle}
      />
    </span>
  );
}

interface HeroFlourishProps {
  logoSrc: string;
  /** Selects the entrance variant; changing it (with a new React key) replays the animation. */
  variant?: number;
  className?: string;
}

export function HeroFlourish({ logoSrc, variant = 0, className = "" }: HeroFlourishProps) {
  const vars = VARIANTS[((variant % VARIANTS.length) + VARIANTS.length) % VARIANTS.length] as CSSProperties;
  // Hold every animation on its first frame until the artwork has loaded, so
  // the bloom and flight are actually seen. Fallback start if the load event
  // was missed (e.g. an image restored from cache before hydration).
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 2500);
    return () => window.clearTimeout(id);
  }, []);
  const markReady = () => setReady(true);
  const cx = (FLOWER_CENTRE.x - WINDOW.x) / WINDOW.width;
  const cy = (FLOWER_CENTRE.y - WINDOW.y) / WINDOW.height;

  return (
    <div
      aria-hidden="true"
      data-hero-flourish
      data-ready={ready}
      // The whole group multiplies onto the hero, so the logo's white paper
      // disappears and only the original black line-art remains visible.
      className={`pointer-events-none absolute isolate select-none mix-blend-multiply ${ready ? "" : styles.waiting} ${className}`}
      style={{ ...vars, aspectRatio: `${WINDOW.width} / ${WINDOW.height}` }}
    >
      <span className={`absolute inset-0 block ${styles.flower}`}>
        <ArtworkLayer src={logoSrc} clip={FLOWER_CLIP} onLoad={markReady} />
      </span>
      <span className={`absolute inset-0 block ${styles.flight}`}>
        <span className={`absolute inset-0 block ${styles.hover}`}>
          <ArtworkLayer src={logoSrc} clip={BIRD_CLIP} onLoad={markReady} />
        </span>
      </span>
      {/* Champagne-gold accents around the feeding flower (multiplied over the line-art). */}
      <span
        className={`absolute size-[34%] mix-blend-multiply -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(198,167,106,0.45),rgba(198,167,106,0))] ${styles.halo}`}
        style={{ left: pct(cx), top: pct(cy) }}
      />
      <svg
        viewBox="0 0 100 100"
        className="absolute size-[40%] -translate-x-1/2 mix-blend-multiply -translate-y-1/2 overflow-visible text-brand-gold"
        style={{ left: pct(cx), top: pct(cy) }}
      >
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
          strokeOpacity="0.75"
          pathLength={1}
          transform="rotate(-90 50 50)"
          className={styles.ring}
        />
      </svg>

    </div>
  );
}
