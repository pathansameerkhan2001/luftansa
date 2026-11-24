import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import localFont from "next/font/local";
import "./globals.css";
import { SiteFooter } from "@/components/footer/SiteFooter";
import { SiteHeader } from "@/components/header/SiteHeader";
import { StorefrontChrome } from "@/components/layout/StorefrontChrome";

// Geist + Geist Mono are self-hosted via Vercel's official `geist` package
// (SIL OFL 1.1). They expose --font-geist-sans / --font-geist-mono.
const geistSans = GeistSans;
const geistMono = GeistMono;

// Editorial serif for headings (hero, section titles). Self-hosted (SIL OFL 1.1,
// see fonts/cormorant-garamond/OFL.txt) so builds never depend on Google Fonts.
const cormorant = localFont({
  variable: "--font-cormorant",
  src: [
    { path: "./fonts/cormorant-garamond/cormorant-garamond-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-latin-500-italic.woff2", weight: "500", style: "italic" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-latin-600-italic.woff2", weight: "600", style: "italic" },
  ],
  display: "swap",
  fallback: ["Times New Roman", "Georgia", "serif"],
  adjustFontFallback: "Times New Roman",
});

// Icons, the Apple touch icon and the Open Graph image are file-based
// (src/app/favicon.ico, icon.png, apple-icon.png, opengraph-image.jpg), all
// made from the Luftansa hummingbird logo. On Vercel, Next.js resolves their
// absolute URLs from the production domain automatically.
export const metadata: Metadata = {
  title: "Luftansa Fragrance Craft Hub",
  description: "Luxury fragrances crafted by Luftansa Fragrance Craft Hub.",
  applicationName: "Luftansa Fragrance Craft Hub",
  openGraph: {
    type: "website",
    siteName: "Luftansa Fragrance Craft Hub",
    title: "Luftansa Fragrance Craft Hub",
    description: "Luxury fragrances crafted by Luftansa Fragrance Craft Hub.",
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#fffdf8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} antialiased`}
      >
        {/* Storefront header/footer (unchanged); hidden only inside /admin, which has its own layout. */}
        <StorefrontChrome>
          <SiteHeader />
        </StorefrontChrome>
        <div id="main-content" tabIndex={-1} className="outline-none">
          {children}
        </div>
        <StorefrontChrome>
          <SiteFooter />
        </StorefrontChrome>
      </body>
    </html>
  );
}
