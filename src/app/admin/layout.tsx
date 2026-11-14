import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { default: "Admin | Luftansa Fragrance Craft Hub", template: "%s | Luftansa Admin" },
  robots: { index: false, follow: false },
};

/** Admin root: separate from the storefront (storefront header/footer are hidden here by StorefrontChrome). */
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-[#f6f2ea]">{children}</div>;
}
