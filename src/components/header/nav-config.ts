export interface NavItem {
  label: string;
  href: string;
}

/**
 * Primary navigation. Single source of truth for desktop + mobile menus.
 * Only destinations that exist: "Our Story" opens the brand story on the
 * homepage and "Contact Us" the contact details in the footer (on every page)
 * until dedicated /our-story and /contact pages are built.
 */
export const PRIMARY_NAV: readonly NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Perfumes", href: "/perfumes" },
  { label: "Roll-On", href: "/roll-on" },
  { label: "Our Story", href: "/#brand-story-heading" },
  { label: "Contact Us", href: "#footer-contact" },
];

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
