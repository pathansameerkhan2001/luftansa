"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

export type RevealState = "idle" | "hidden" | "shown";

/**
 * Scroll-reveal without an animation library (Phase 4).
 *
 * Content is visible by default (server HTML, no JavaScript, reduced motion,
 * or already on screen when the page loads). Only content that is still below
 * the fold after hydration is hidden, then revealed when it scrolls into view,
 * so nothing ever flashes and nothing can stay hidden. Only opacity and
 * transform change: no layout shift.
 */
export function useReveal(ref: RefObject<HTMLElement | null>, threshold = 0.15): RevealState {
  const [state, setState] = useState<RevealState>("idle");
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return; // already in view: no animation
    let revealed = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          if (!revealed) setState("hidden");
          return;
        }
        revealed = true;
        setState("shown");
        io.disconnect();
      },
      { threshold, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);
  return state;
}

/** Classes for a revealing element (fade + gentle rise). */
export function revealClass(state: RevealState): string {
  if (state === "hidden") return "translate-y-6 opacity-0";
  if (state === "shown") return "translate-y-0 opacity-100 transition-[opacity,transform] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]";
  return "";
}

export function Reveal({ children, className = "", delayMs = 0 }: { children: ReactNode; className?: string; delayMs?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const state = useReveal(ref);
  return (
    <div ref={ref} className={`${className} ${revealClass(state)}`} style={state === "shown" && delayMs ? { transitionDelay: `${delayMs}ms` } : undefined} data-reveal={state}>
      {children}
    </div>
  );
}
