"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Menu, User, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { PRIMARY_NAV, UTILITY_LINKS, isActivePath } from "./nav-config";

export function MobileMenu() {
  const pathname = usePathname();
  // Store the path the menu was opened on: navigating elsewhere closes it
  // automatically without a state-syncing effect.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;

  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpenedOn(null);
    toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onBreakpoint = () => desktop.matches && setOpenedOn(null);

    document.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onBreakpoint);
    return () => {
      root.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onBreakpoint);
    };
  }, [open, close]);

  return (
    <div className="lg:hidden">
      <button
        ref={toggleRef}
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpenedOn(pathname)}
        className="-ml-2 inline-flex size-10 items-center justify-center text-brand-text transition-colors hover:text-brand-gold focus-visible:outline-1 focus-visible:outline-brand-gold"
      >
        <Menu aria-hidden="true" className="size-5" strokeWidth={1.5} />
      </button>

      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={close}
        className={`fixed inset-0 z-40 bg-brand-black/40 transition-opacity duration-300 motion-reduce:transition-none ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Drawer */}
      <div
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        inert={!open}
        className={`fixed inset-y-0 left-0 z-50 flex w-[86%] max-w-sm flex-col bg-brand-ivory shadow-xl transition-transform duration-300 ease-out motion-reduce:transition-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-brand-gold/25 px-5">
          <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-brand-text/70">
            Menu
          </span>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close menu"
            onClick={close}
            className="-mr-2 inline-flex size-10 items-center justify-center text-brand-text transition-colors hover:text-brand-gold focus-visible:outline-1 focus-visible:outline-brand-gold"
          >
            <X aria-hidden="true" className="size-5" strokeWidth={1.5} />
          </button>
        </div>

        <nav aria-label="Mobile primary" className="flex-1 overflow-y-auto px-5 py-4">
          <ul className="divide-y divide-brand-gold/15">
            {PRIMARY_NAV.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpenedOn(null)}
                    className={`flex items-center justify-between py-4 text-[13px] font-medium uppercase tracking-[0.2em] transition-colors hover:text-brand-gold focus-visible:outline-1 focus-visible:outline-brand-gold ${
                      active ? "text-brand-black" : "text-brand-text"
                    }`}
                  >
                    <span className={active ? "border-b border-brand-gold pb-1" : "pb-1"}>
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex flex-col gap-1 border-t border-brand-gold/25 bg-brand-cream px-5 py-4">
          {[
            { ...UTILITY_LINKS.account, Icon: User },
            { ...UTILITY_LINKS.wishlist, Icon: Heart },
          ].map(({ label, href, Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpenedOn(null)}
              className="flex items-center gap-3 py-2 text-[12px] uppercase tracking-[0.18em] text-brand-text transition-colors hover:text-brand-gold focus-visible:outline-1 focus-visible:outline-brand-gold"
            >
              <Icon aria-hidden="true" className="size-[18px]" strokeWidth={1.5} />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
