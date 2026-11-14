import {
  Boxes,
  FileText,
  ImageIcon,
  LayoutDashboard,
  Package,
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

/** Admin sidebar navigation (single source of truth for sidebar + page titles). */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { label: "Dashboard", href: "/admin", Icon: LayoutDashboard, description: "Store overview and recent activity." },
  { label: "Products", href: "/admin/products", Icon: Package, description: "Fragrances, sizes, prices, images and SEO." },
  { label: "Inventory", href: "/admin/inventory", Icon: Boxes, description: "Stock levels, low-stock warnings and history." },
  { label: "Orders", href: "/admin/orders", Icon: ShoppingCart, description: "Orders, payment status, fulfilment and tracking." },
  { label: "Customers", href: "/admin/customers", Icon: Users, description: "Customer profiles and order history." },
  { label: "Media Library", href: "/admin/media", Icon: ImageIcon, description: "Images and videos stored in the private S3 bucket." },
  { label: "Website Content", href: "/admin/content", Icon: FileText, description: "Homepage sections from the announcement bar to the FAQ." },
  { label: "Promotions", href: "/admin/promotions", Icon: Tag, description: "Discounts, offers and promotional banners." },
  { label: "Store Settings", href: "/admin/settings", Icon: Settings, description: "Contact details, WhatsApp, social links and shipping." },
];

export function isActiveAdminPath(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
