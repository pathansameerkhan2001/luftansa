import type { ReactNode } from "react";
import { AnnouncementBar } from "./AnnouncementBar";
import { BrandLogo } from "./BrandLogo";
import { DesktopNav } from "./DesktopNav";
import { MobileMenu } from "./MobileMenu";
import { loadPrimaryNav } from "./primary-nav";
import { UtilityNav } from "./UtilityNav";

/**
 * Site header: announcement bar → centred brand logo → navigation row.
 * Server Component; only DesktopNav (active-link and dropdown state) and
 * MobileMenu (drawer state) ship client JavaScript. The navigation items,
 * including the COLLECTIONS dropdown, come from Admin → Collections Menu.
 * `announcement` replaces the live announcement bar (admin previews only).
 */
export async function SiteHeader({ announcement }: { announcement?: ReactNode } = {}) {
  const nav = await loadPrimaryNav();
  return (
    <header className="w-full">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-[60] focus:bg-brand-ivory focus:px-4 focus:py-2 focus:text-sm focus:text-brand-black focus:outline-1 focus:outline-brand-gold"
      >
        Skip to content
      </a>

      {announcement === undefined ? <AnnouncementBar /> : announcement}
      <BrandLogo />

      <div className="relative border-y border-brand-gold/25 bg-brand-ivory">
        <div className="mx-auto grid h-14 max-w-7xl lg:h-16 grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6 lg:px-8">
          <div className="justify-self-start">
            <MobileMenu items={nav} />
          </div>
          {/* Wrapper keeps the centre column occupied when the nav is hidden below lg. */}
          <div className="justify-self-center">
            <DesktopNav items={nav} />
          </div>
          <div className="justify-self-end">
            <UtilityNav />
          </div>
        </div>
      </div>
    </header>
  );
}
