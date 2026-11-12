import Link from "next/link";
import { Heart, ShoppingBag, User, type LucideIcon } from "lucide-react";
import { UTILITY_LINKS } from "./nav-config";
import { SearchToggle } from "./SearchToggle";

const LINKS: { label: string; href: string; Icon: LucideIcon; hideOnMobile?: boolean }[] = [
  { ...UTILITY_LINKS.account, Icon: User, hideOnMobile: true },
  { ...UTILITY_LINKS.wishlist, Icon: Heart, hideOnMobile: true },
  { ...UTILITY_LINKS.cart, Icon: ShoppingBag },
];

export function UtilityNav() {
  return (
    <ul aria-label="Shop tools" className="-mr-2 flex items-center sm:gap-1">
      {/* On lg+ the inline search field in the logo row replaces this icon. */}
      <li className="lg:hidden">
        <SearchToggle />
      </li>
      {LINKS.map(({ label, href, Icon, hideOnMobile }) => (
        <li key={href} className={hideOnMobile ? "hidden sm:block" : undefined}>
          <Link
            href={href}
            aria-label={label}
            title={label}
            className="inline-flex size-10 items-center justify-center text-brand-text transition-colors duration-200 hover:text-brand-gold focus-visible:outline-1 focus-visible:outline-brand-gold"
          >
            <Icon aria-hidden="true" className="size-5" strokeWidth={1.5} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
