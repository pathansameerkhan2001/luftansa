"use client";

import { Search, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { SearchForm } from "./SearchForm";

/**
 * Below lg the inline search field is hidden; this icon opens the same compact
 * form in a slim panel beneath the navigation row (no overflow on small screens).
 * The panel is positioned against the navigation row, which is `relative`.
 */
export function SearchToggle() {
  const pathname = usePathname();
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpenedOn(null);
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onBreakpoint = () => desktop.matches && setOpenedOn(null);
    document.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onBreakpoint);
    return () => {
      document.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onBreakpoint);
    };
  }, [open, close]);

  const Icon = open ? X : Search;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? "Close search" : "Search"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : setOpenedOn(pathname))}
        className="inline-flex size-10 items-center justify-center text-brand-text transition-colors duration-200 hover:text-brand-gold focus-visible:outline-1 focus-visible:outline-brand-gold"
      >
        <Icon aria-hidden="true" className="size-5" strokeWidth={1.5} />
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full z-30 border-b border-brand-gold/25 bg-brand-ivory"
      >
        <div className="mx-auto max-w-xl px-4 py-3 sm:px-6">
          {open && <SearchForm id={`${panelId}-input`} autoFocus />}
        </div>
      </div>
    </>
  );
}
