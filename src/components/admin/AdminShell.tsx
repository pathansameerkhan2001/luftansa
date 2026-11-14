"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, LogOut, Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ADMIN_NAV, isActiveAdminPath } from "./admin-nav";

const FOCUS_DARK = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c6a76a]";
const FOCUS_LIGHT = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold";

const WINDOW = { x: 175, y: 212, width: 903, height: 1074 } as const;
const LOGO_DIMS = { width: 1183, height: 1600 } as const;
const pct = (n: number) => `${(n * 100).toFixed(4)}%`;

function Brand({ logoUrl = "/media/logo/logo.jpeg" }: { logoUrl?: string }) {
  return (
    <div className="flex items-center gap-3.5 px-5 py-5">
      <Link
        href="/admin"
        aria-label="Luftansa Admin"
        className="group relative flex shrink-0 items-center justify-center rounded-2xl bg-brand-ivory p-2 ring-1 ring-[#c6a76a]/60 shadow-[0_4px_14px_rgba(0,0,0,0.35)] transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c6a76a]"
      >
        <span
          className="relative block h-11 overflow-hidden"
          style={{ aspectRatio: `${WINDOW.width} / ${WINDOW.height}` }}
        >
          <Image
            src={logoUrl}
            alt="Luftansa"
            width={LOGO_DIMS.width}
            height={LOGO_DIMS.height}
            sizes="50px"
            className="absolute mix-blend-multiply"
            style={{
              width: pct(LOGO_DIMS.width / WINDOW.width),
              height: pct(LOGO_DIMS.height / WINDOW.height),
              left: pct(-WINDOW.x / WINDOW.width),
              top: pct(-WINDOW.y / WINDOW.height),
              maxWidth: "none",
            }}
          />
        </span>
      </Link>
      <div className="min-w-0 leading-tight">
        <Link
          href="/admin"
          className="font-serif text-[21px] font-semibold tracking-[0.02em] text-white hover:text-[#e9d6ab] transition-colors"
        >
          Luftansa
        </Link>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="inline-block size-1.5 rounded-full bg-[#c6a76a]" aria-hidden="true" />
          <p className="text-[10px] font-semibold tracking-[0.24em] text-[#c6a76a] uppercase">Admin</p>
        </div>
      </div>
    </div>
  );
}

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Admin sections" className="flex-1 overflow-y-auto px-3 py-4">
      <ul className="space-y-1">
        {ADMIN_NAV.map(({ label, href, Icon }) => {
          const active = isActiveAdminPath(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] transition-all duration-150 ${FOCUS_DARK} ${
                  active
                    ? "bg-gradient-to-r from-[#c6a76a]/20 to-[#c6a76a]/5 font-semibold text-[#f8f5ec] shadow-[inset_3px_0_0_#c6a76a] ring-1 ring-[#c6a76a]/30"
                    : "text-white/65 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <Icon
                  aria-hidden="true"
                  className={`size-[18px] shrink-0 transition-colors ${
                    active ? "text-[#c6a76a]" : "text-white/45 group-hover:text-[#c6a76a]/90"
                  }`}
                  strokeWidth={1.6}
                />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Admin layout: dark sidebar (drawer on mobile), top bar with profile + sign out, ivory workspace. */
export function AdminShell({
  email,
  logoUrl,
  children,
}: {
  email: string;
  logoUrl?: string;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "/admin";
  const [open, setOpen] = useState(false);
  const current = ADMIN_NAV.find((n) => isActiveAdminPath(pathname, n.href));
  const initial = email.charAt(0).toUpperCase();

  // Close the drawer on Escape; lock background scroll while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    // The background paints the full-height sidebar column dark on lg+ (the sticky aside itself is viewport-high).
    <div className="min-h-dvh bg-[#f6f2ea] text-brand-black lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:bg-[linear-gradient(to_right,#161513_260px,#f6f2ea_260px)]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-black/40 bg-[#161513] lg:flex" data-admin-sidebar>
        <Brand logoUrl={logoUrl} />
        <div className="mx-5 h-px bg-gradient-to-r from-[#c6a76a]/50 to-transparent" />
        <SidebarNav pathname={pathname} />
        <div className="border-t border-white/10 px-5 py-4">
          <Link
            href="/"
            className={`inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-white/55 transition-colors hover:bg-white/5 hover:text-[#e9d6ab] ${FOCUS_DARK}`}
          >
            <ExternalLink aria-hidden="true" className="size-3.5 text-[#c6a76a]" />
            View storefront
          </Link>
        </div>
      </aside>

      {/* Mobile / tablet drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin navigation">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-[min(280px,85vw)] flex-col bg-[#161513] shadow-2xl" data-admin-drawer>
            <div className="flex items-center justify-between pr-3">
              <Brand logoUrl={logoUrl} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className={`inline-flex size-10 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 ${FOCUS_DARK}`}
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <div className="mx-5 h-px bg-gradient-to-r from-[#c6a76a]/50 to-transparent" />
            <SidebarNav pathname={pathname} onNavigate={() => setOpen(false)} />
            <div className="border-t border-white/10 px-5 py-4">
              <Link
                href="/"
                className={`inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-white/55 transition-colors hover:bg-white/5 hover:text-[#e9d6ab] ${FOCUS_DARK}`}
              >
                <ExternalLink aria-hidden="true" className="size-3.5 text-[#c6a76a]" />
                View storefront
              </Link>
            </div>
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[#e3d6bd] bg-[#fffdf8]/95 px-4 backdrop-blur sm:px-6" data-admin-topbar>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            aria-expanded={open}
            className={`inline-flex size-10 items-center justify-center rounded-lg text-brand-black hover:bg-black/5 lg:hidden ${FOCUS_LIGHT}`}
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-[20px] leading-tight font-semibold sm:text-[22px]">{current?.label ?? "Admin"}</p>
          </div>

          <div className="flex items-center gap-3" data-admin-profile>
            <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#161513] text-[13px] font-semibold text-[#e9d6ab] ring-1 ring-[#c6a76a]/60 shadow-sm">
              {initial}
            </span>
            <div className="hidden min-w-0 leading-tight sm:block">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-brand-text/55 uppercase">Administrator</p>
              <p className="max-w-[220px] truncate text-[13px] font-medium" title={email}>
                {email}
              </p>
            </div>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className={`inline-flex h-9 items-center gap-2 rounded-xl border border-[#d9c79f] bg-white px-3 text-[13px] font-medium text-brand-black shadow-xs transition-colors hover:border-brand-black hover:bg-brand-black hover:text-white ${FOCUS_LIGHT}`}
              >
                <LogOut aria-hidden="true" className="size-4" strokeWidth={1.75} />
                <span className="hidden sm:inline">Sign out</span>
                <span className="sr-only sm:hidden">Sign out</span>
              </button>
            </form>
          </div>
        </header>

        <main id="admin-main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
