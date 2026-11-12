import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import { ANNOUNCEMENT } from "./nav-config";

/**
 * Enough copies per half of the track to exceed ultra-wide viewports (~3400px+).
 * The track holds two identical halves; animating translateX(0 → -50%) moves it
 * by exactly one half, so the loop restarts on an identical frame (no jump).
 */
const COPIES_PER_HALF = 8;

function Message() {
  return (
    <span className="inline-flex shrink-0 items-center gap-2 pr-16 sm:pr-24">
      <Star aria-hidden="true" className="size-3 shrink-0 fill-brand-gold text-brand-gold" strokeWidth={1.5} />
      <span className="font-medium">{ANNOUNCEMENT.highlight}</span>
      <span className="text-white/50">—</span>
      <span className="text-white/85 transition-colors group-hover:text-brand-gold">{ANNOUNCEMENT.cta}</span>
      <ArrowRight
        aria-hidden="true"
        className="size-3 shrink-0 text-white/70 transition-colors group-hover:text-brand-gold"
        strokeWidth={1.5}
      />
    </span>
  );
}

export function AnnouncementBar() {
  return (
    <div className="bg-brand-black text-white">
      <Link
        href={ANNOUNCEMENT.href}
        className="group relative flex h-9 items-center overflow-hidden text-[11px] tracking-[0.08em] whitespace-nowrap focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-brand-gold sm:text-xs sm:tracking-[0.12em] lg:h-10"
      >
        <span className="sr-only">
          {ANNOUNCEMENT.highlight} — {ANNOUNCEMENT.cta}
        </span>

        {/* Animated ticker (decorative duplicate of the sr-only text). */}
        <span
          aria-hidden="true"
          className="flex w-max animate-marquee will-change-transform group-hover:[animation-play-state:paused] group-focus-visible:[animation-play-state:paused] motion-reduce:hidden"
        >
          {Array.from({ length: COPIES_PER_HALF * 2 }, (_, i) => (
            <Message key={i} />
          ))}
        </span>

        {/* Static, centred message for users who prefer reduced motion. */}
        <span aria-hidden="true" className="hidden w-full justify-center motion-reduce:flex">
          <span className="inline-flex items-center gap-2">
            <Star aria-hidden="true" className="size-3 shrink-0 fill-brand-gold text-brand-gold" strokeWidth={1.5} />
            <span className="font-medium">{ANNOUNCEMENT.highlight}</span>
            <span className="text-white/50">—</span>
            <span className="text-white/85 group-hover:text-brand-gold group-hover:underline underline-offset-4">
              {ANNOUNCEMENT.cta}
            </span>
            <ArrowRight aria-hidden="true" className="size-3 shrink-0 text-white/70" strokeWidth={1.5} />
          </span>
        </span>
      </Link>
    </div>
  );
}
