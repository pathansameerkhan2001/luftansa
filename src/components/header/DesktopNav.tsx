"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRIMARY_NAV, isActivePath } from "./nav-config";

export function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="hidden lg:block">
      <ul className="flex items-center gap-7 lg:gap-10">
        {PRIMARY_NAV.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "relative inline-block py-1 text-[12px] font-medium uppercase tracking-[0.18em] text-brand-text transition-colors duration-200",
                  "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-center after:bg-brand-gold after:transition-transform after:duration-300 motion-reduce:after:transition-none",
                  "hover:text-brand-black focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-brand-gold",
                  active ? "after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100",
                ].join(" ")}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
