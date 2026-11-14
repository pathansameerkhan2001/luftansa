import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import localFont from "next/font/local";
import "./globals.css";
import { SiteFooter } from "@/components/footer/SiteFooter";
import { SiteHeader } from "@/components/header/SiteHeader";

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

export const metadata: Metadata = {
  title: "Luftansa Fragrance Craft Hub",
  description: "Luxury fragrances crafted by Luftansa Fragrance Craft Hub.",
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
        <SiteHeader />
        <div id="main-content" tabIndex={-1} className="outline-none">
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
