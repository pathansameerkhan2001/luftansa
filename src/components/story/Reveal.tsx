"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type RevealState = "static" | "armed" | "shown";

/**
 * Scroll-triggered reveal. Server HTML is fully visible ("static"), so content
 * never depends on JavaScript. After hydration the element is "armed" (hidden)
 * only if it is still below the fold, then "shown" once it scrolls into view.
 * Reduced-motion users always get the static, visible state.
 *
 * Style the states with Tailwind data variants, e.g.
 *   data-[reveal=armed]:opacity-0 data-[reveal=armed]:translate-y-4
 */
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<RevealState>("static");

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return; // already in view
    // Arming after hydration hides content that is still below the fold.
    setState("armed");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState("shown");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} data-reveal={state} className={`group/reveal ${className}`}>
      {children}
    </div>
  );
}
