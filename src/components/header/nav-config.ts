import type { NavCollectionsMenu } from "@/lib/cms/modules/nav-collections";

export interface NavLink {
  label: string;
  href: string;
}

/** A top-level entry: a link, or a dropdown group of links (COLLECTIONS). */
export type NavItem = (NavLink & { children?: undefined }) | { label: string; href?: undefined; children: readonly NavLink[] };

/**
 * Primary navigation, built from the Collections menu (Admin → Collections
 * Menu). Single source of truth for desktop + mobile menus. Only destinations
 * that exist: "Our Story" opens /our-story (which sends visitors to the
 * homepage brand story while it is deactivated in Admin) and "Contact Us" the
 * /contact page. Without active collections there is no COLLECTIONS entry.
 */
export function buildPrimaryNav(collections: NavCollectionsMenu | null): NavItem[] {
  return [
    { label: "Home", href: "/" },
    { label: "Perfumes", href: "/perfumes" },
    ...(collections ? [{ label: collections.label, children: collections.items }] : []),
    { label: "Our Story", href: "/our-story" },
    { label: "Contact Us", href: "/contact" },
  ];
}

/**
 * The header cart icon stays hidden until an online cart and checkout exist
 * (ordering is currently done on WhatsApp from each product page). Set to true
 * only once /cart is a working page.
 */
export const SHOW_CART_ICON = false;

/** The wishlist icon stays hidden until /wishlist is a working page (it would otherwise lead to a missing page). */
export const SHOW_WISHLIST_ICON = false;

export const UTILITY_LINKS = {
  search: { label: "Search", href: "/search" },
  account: { label: "Account", href: "/account" },
  wishlist: { label: "Wishlist", href: "/wishlist" },
  cart: { label: "Shopping bag", href: "/cart" },
} as const;

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** A dropdown group is active when the current page is one of its links. */
export function isActiveItem(pathname: string, item: NavItem): boolean {
  return item.children ? item.children.some((c) => isActivePath(pathname, c.href)) : isActivePath(pathname, item.href);
}
