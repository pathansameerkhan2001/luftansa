"use client";

import { Pause, Play } from "lucide-react";
import { useState } from "react";
import type { AnnouncementMessageView } from "@/lib/cms/modules/announcement-bar";
import { AnnouncementMessageItem } from "./AnnouncementMessage";

/**
 * Message slots per half of the track: enough to exceed ultra-wide viewports
 * (~3400px+). The track holds two identical halves; animating translateX
 * (0 → -50%) moves it by exactly one half, so the loop restarts on an
 * identical frame (no jump).
 */
const SLOTS_PER_HALF = 8;
/** Same speed as the original bar (8 copies in 90s), whatever the number of messages. */
const SECONDS_PER_SLOT = 90 / 8;

/**
 * Scrolling ticker (Phase 3B, Checkpoint B).
 *
 * Accessibility:
 *   - Screen readers get each message once, in order (the moving track is a
 *     decorative, aria-hidden duplicate whose links are mouse/touch only).
 *   - Keyboard users tab through the same list; the focused message appears
 *     over the ticker, standing still, with a visible focus ring.
 *   - The ticker pauses on hover and with the Pause button (WCAG 2.2.2).
 *   - With reduced motion, nothing moves: the messages sit in a static row
 *     (scrollable by hand if they do not fit) and the Pause button is hidden.
 */
export function AnnouncementTicker({ messages }: { messages: readonly AnnouncementMessageView[] }) {
  const [paused, setPaused] = useState(false);
  const copies = Math.max(1, Math.ceil(SLOTS_PER_HALF / messages.length));
  const half = Array.from({ length: copies }, () => messages).flat();
  const track = [...half, ...half];

  return (
    <div className="group relative flex h-9 items-center overflow-hidden text-[11px] tracking-[0.08em] whitespace-nowrap sm:text-xs sm:tracking-[0.12em] lg:h-10" data-ticker={paused ? "paused" : "running"}>
      {/* Accessible messages: invisible until a link inside receives keyboard focus. */}
      <ul className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-10 overflow-hidden bg-brand-black px-12 opacity-0 focus-within:pointer-events-auto focus-within:opacity-100 [&:focus-within>li:not(:focus-within)]:hidden">
        {messages.map((m) => (
          <li key={m.id} className="shrink-0">
            <AnnouncementMessageItem message={m} />
          </li>
        ))}
      </ul>

      {/* Animated ticker (decorative duplicate of the list above). */}
      <div
        aria-hidden="true"
        className="flex w-max animate-marquee will-change-transform group-hover:[animation-play-state:paused] motion-reduce:hidden"
        style={{ animationDuration: `${half.length * SECONDS_PER_SLOT}s`, ...(paused ? { animationPlayState: "paused" } : {}) }}
      >
        {track.map((m, i) => (
          <AnnouncementMessageItem key={`${m.id}-${i}`} message={m} focusable={false} className="shrink-0 pr-16 sm:pr-24" />
        ))}
      </div>

      {/* Reduced motion: a static row (centred when it fits). */}
      <div aria-hidden="true" className="hidden h-full w-full overflow-x-auto [scrollbar-width:none] motion-reduce:flex">
        <div className="mx-auto flex w-max items-center gap-10 px-4">
          {messages.map((m) => (
            <AnnouncementMessageItem key={m.id} message={m} focusable={false} className="shrink-0" />
          ))}
        </div>
      </div>

      <div className="absolute inset-y-0 right-0 z-20 flex items-center bg-gradient-to-l from-brand-black from-60% to-transparent pr-1.5 pl-6 motion-reduce:hidden">
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Play announcements" : "Pause announcements"}
          className="inline-flex size-7 items-center justify-center rounded-full text-white/70 transition-colors hover:text-brand-gold focus-visible:outline-1 focus-visible:outline-brand-gold"
          data-ticker-toggle
        >
          {paused ? <Play aria-hidden="true" className="size-3" strokeWidth={1.75} /> : <Pause aria-hidden="true" className="size-3" strokeWidth={1.75} />}
        </button>
      </div>
    </div>
  );
}
