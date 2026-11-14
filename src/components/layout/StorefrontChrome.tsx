"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Renders storefront chrome (the existing header or footer, passed in
 * unchanged as children) on every route except the admin dashboard, which has
 * its own layout. Adds no wrapper element, so storefront HTML is unchanged,
 * including server-rendered 404 pages.
 *
 * Known trade-off: on /admin pages the header/footer are not rendered, but
 * their serialized React payload is still sent (Next.js renders server
 * components passed as children). See docs/admin-architecture.md.
 */
export function StorefrontChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname?.startsWith("/admin/")) return null;
  return <>{children}</>;
}
