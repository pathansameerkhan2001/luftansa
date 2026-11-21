import {
  Boxes,
  FileText,
  ImageIcon,
  LayoutDashboard,
  Megaphone,
  Package,
  PanelTop,
  Settings,
  ShoppingCart,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  label: string;
  href: string;
  Icon: LucideIcon;
  description: string;
}

export interface AdminNavGroup {
  label: string;
  items: readonly AdminNavItem[];
}

const DASHBOARD: AdminNavItem = { label: "Dashboard", href: "/admin", Icon: LayoutDashboard, description: "Store overview and recent activity." };
const PRODUCTS: AdminNavItem = { label: "Products", href: "/admin/products", Icon: Package, description: "Fragrances, sizes, prices, images and SEO." };
const HERO: AdminNavItem = { label: "Hero Section", href: "/admin/hero", Icon: PanelTop, description: "Homepage hero images, videos, heading and button." };
const ANNOUNCEMENT: AdminNavItem = { label: "Announcement Bar", href: "/admin/announcement-bar", Icon: Megaphone, description: "Messages in the bar above the header: order, schedule and display." };
const MEDIA: AdminNavItem = { label: "Media Library", href: "/admin/media", Icon: ImageIcon, description: "Images and videos, usage and safe deletion." };

/**
 * Sidebar navigation, grouped. Only modules that genuinely work are listed
 * (no non-functional entries). Website pages are added in Phase 3B as each
 * one is built (docs/phase-3b-plan.md).
 */
export const ADMIN_NAV_GROUPS: readonly AdminNavGroup[] = [
  { label: "Store Management", items: [DASHBOARD, PRODUCTS] },
  { label: "Website", items: [HERO, ANNOUNCEMENT] },
  { label: "Media", items: [MEDIA] },
];

/** Every sidebar entry (flattened). */
export const ADMIN_NAV: readonly AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap((g) => g.items);

/**
 * Pages that still exist as placeholders but are hidden from the sidebar until
 * they have genuine functionality (D5: Orders and Customers; the others are
 * replaced by real modules in later phases). Kept only for page titles.
 */
const HIDDEN_PAGES: readonly AdminNavItem[] = [
  { label: "Inventory", href: "/admin/inventory", Icon: Boxes, description: "Stock levels, low-stock warnings and history." },
  { label: "Orders", href: "/admin/orders", Icon: ShoppingCart, description: "Orders, payment status, fulfilment and tracking." },
  { label: "Customers", href: "/admin/customers", Icon: Users, description: "Customer profiles and order history." },
  { label: "Website Content", href: "/admin/content", Icon: FileText, description: "Homepage sections from the announcement bar to the FAQ." },
  { label: "Promotions", href: "/admin/promotions", Icon: Tag, description: "Discounts, offers and promotional banners." },
  { label: "Store Settings", href: "/admin/settings", Icon: Settings, description: "Contact details, WhatsApp, social links and shipping." },
];

export const ADMIN_PAGES: readonly AdminNavItem[] = [...ADMIN_NAV, ...HIDDEN_PAGES];

export function isActiveAdminPath(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
