"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { isActiveItem, isActivePath, type NavItem, type NavLink } from "./nav-config";

const ITEM_CLASS = [
  "relative inline-flex items-center gap-1.5 py-1 text-[12px] font-medium uppercase tracking-[0.18em] text-brand-black transition-colors duration-200",
  "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-center after:bg-brand-gold after:transition-transform after:duration-300 motion-reduce:after:transition-none",
  "hover:text-brand-black focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-brand-gold",
].join(" ");

const underline = (active: boolean) => (active ? "after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100");

/** Delay before a hover-opened dropdown closes, so moving the mouse into the panel never closes it. */
const HOVER_CLOSE_MS = 140;

/**
 * Dropdown group (disclosure pattern: a button that shows a list of links).
 * Opens on mouse hover and on click/tap; Enter, Space or ArrowDown open it and
 * move focus to the first link; ArrowUp/ArrowDown move between links, Home/End
 * jump, Escape closes and returns focus to the button. Closes when focus or a
 * click leaves it, and on navigation.
 */
function NavDropdown({ label, items, pathname }: { label: string; items: readonly NavLink[]; pathname: string }) {
  // "hover": opened by the mouse (closes when it leaves); "click": pinned open until dismissed.
  const [state, setState] = useState<{ on: string; by: "hover" | "click" } | null>(null);
  const open = state !== null && state.on === pathname;
  const panelId = useId();
  const rootRef = useRef<HTMLLIElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = items.some((i) => isActivePath(pathname, i.href));

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const close = useCallback((refocus = false) => {
    setState(null);
    if (refocus) buttonRef.current?.focus();
  }, []);
  const links = () => Array.from(rootRef.current?.querySelectorAll<HTMLAnchorElement>("[data-nav-dropdown-link]") ?? []);
  const focusLink = (index: number) => {
    const all = links();
    if (all.length) all[(index + all.length) % all.length].focus();
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  useEffect(() => cancelClose, []);

  const onButtonKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || ((e.key === "Enter" || e.key === " ") && !open)) {
      e.preventDefault();
      setState({ on: pathname, by: "click" });
      requestAnimationFrame(() => focusLink(0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setState({ on: pathname, by: "click" });
      requestAnimationFrame(() => focusLink(-1));
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      close();
    }
  };

  const onPanelKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const all = links();
    const i = all.indexOf(document.activeElement as HTMLAnchorElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusLink(i + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusLink(i - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusLink(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusLink(-1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    }
  };

  return (
    <li
      ref={rootRef}
      className="relative"
      data-nav-dropdown
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        cancelClose();
        if (!open) setState({ on: pathname, by: "hover" });
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse" || state?.by !== "hover") return;
        cancelClose();
        closeTimer.current = setTimeout(() => close(), HOVER_CLOSE_MS);
      }}
      onBlur={(e) => {
        if (open && !rootRef.current?.contains(e.relatedTarget as Node | null)) close();
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          cancelClose();
          // A click on a hover-opened menu pins it open instead of closing it.
          setState(open && state?.by === "click" ? null : { on: pathname, by: "click" });
        }}
        onKeyDown={onButtonKey}
        className={`${ITEM_CLASS} ${underline(active || open)}`}
      >
        {label}
        <ChevronDown aria-hidden="true" className={`size-3.5 text-brand-gold transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} strokeWidth={1.75} />
      </button>

      {/* pt-4 is a hover bridge between the button and the panel. */}
      <div className={`absolute top-full left-1/2 z-40 -translate-x-1/2 pt-4 ${open ? "" : "hidden"}`}>
        <ul
          id={panelId}
          aria-label={label}
          onKeyDown={onPanelKey}
          className="min-w-[240px] border border-brand-gold/30 bg-brand-ivory py-2 shadow-[0_12px_32px_-12px_rgba(22,21,19,0.25)]"
          data-nav-dropdown-panel
        >
          {items.map((item) => {
            const current = isActivePath(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  data-nav-dropdown-link
                  aria-current={current ? "page" : undefined}
                  onClick={() => close()}
                  className={`block px-5 py-3 text-[12px] font-medium whitespace-nowrap uppercase tracking-[0.16em] transition-colors hover:bg-brand-cream hover:text-brand-black focus-visible:bg-brand-cream focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-brand-gold ${
                    current ? "text-brand-black" : "text-brand-text"
                  }`}
                >
                  <span className={current ? "border-b border-brand-gold pb-0.5" : undefined}>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </li>
  );
}

export function DesktopNav({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="hidden lg:block">
      <ul className="flex items-center gap-7 lg:gap-10">
        {items.map((item) => {
          if (item.children) return <NavDropdown key={`group:${item.label}`} label={item.label} items={item.children} pathname={pathname} />;
          const active = isActiveItem(pathname, item);
          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={active ? "page" : undefined} className={`${ITEM_CLASS} ${underline(active)}`}>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
