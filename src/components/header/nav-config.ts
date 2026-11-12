export interface NavItem {
  label: string;
  href: string;
}

/** Primary navigation. Single source of truth for desktop + mobile menus. */
export const PRIMARY_NAV: readonly NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Shop All", href: "/shop" },
  { label: "Collection", href: "/collections" },
  { label: "Our Story", href: "/our-story" },
  { label: "Contact Us", href: "/contact" },
];

export const UTILITY_LINKS = {
  search: { label: "Search", href: "/search" },
  account: { label: "Account", href: "/account" },
  wishlist: { label: "Wishlist", href: "/wishlist" },
  cart: { label: "Shopping bag", href: "/cart" },
} as const;

export const ANNOUNCEMENT = {
  highlight: "20,000+ Verified Reviews",
  cta: "See All Reviews",
  href: "/reviews",
} as const;

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
