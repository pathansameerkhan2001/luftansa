import { AnnouncementBar } from "./AnnouncementBar";
import { BrandLogo } from "./BrandLogo";
import { DesktopNav } from "./DesktopNav";
import { MobileMenu } from "./MobileMenu";
import { UtilityNav } from "./UtilityNav";

/**
 * Site header: announcement bar → centred brand logo → navigation row.
 * Server Component; only DesktopNav (active-link state) and MobileMenu
 * (drawer state) ship client JavaScript.
 */
export function SiteHeader() {
  return (
    <header className="w-full">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-[60] focus:bg-brand-ivory focus:px-4 focus:py-2 focus:text-sm focus:text-brand-black focus:outline-1 focus:outline-brand-gold"
      >
        Skip to content
      </a>

      <AnnouncementBar />
      <BrandLogo />

      <div className="border-y border-brand-gold/25 bg-brand-ivory">
        <div className="mx-auto grid h-14 max-w-7xl lg:h-16 grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6 lg:px-8">
          <div className="justify-self-start">
            <MobileMenu />
          </div>
          {/* Wrapper keeps the centre column occupied when the nav is hidden below lg. */}
          <div className="justify-self-center">
            <DesktopNav />
          </div>
          <div className="justify-self-end">
            <UtilityNav />
          </div>
        </div>
      </div>
    </header>
  );
}
