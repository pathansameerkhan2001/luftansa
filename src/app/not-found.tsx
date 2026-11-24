import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { PerfumeBottleIcon } from "@/components/benefits/BenefitsStrip";
import { PillLink } from "@/components/collection/ProductGrid";
import { STORE_NAME } from "@/data/store";

export const metadata: Metadata = { title: `Page not found | ${STORE_NAME}`, robots: { index: false } };

/** Site-wide 404: on brand, with search and the main destinations. */
export default function NotFound() {
  return (
    <main className="bg-brand-ivory">
      <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-16 text-center sm:py-24">
        <PerfumeBottleIcon aria-hidden="true" className="size-16 text-brand-gold/70" strokeWidth={0.75} />
        <p className="mt-6 text-[11px] font-medium tracking-[0.32em] text-brand-text/60 uppercase">Error 404</p>
        <h1 className="mt-3 font-serif text-[36px] leading-tight font-semibold text-brand-black italic sm:text-[46px]">Page not found</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-brand-text/75">The page you are looking for may have moved, or the link may be incorrect.</p>

        <form role="search" action="/search" method="get" className="mt-8 w-full max-w-md">
          <div className="flex h-12 items-center gap-3 rounded-full border border-brand-gold/50 bg-white/80 pr-1.5 pl-5 focus-within:border-brand-gold focus-within:shadow-[0_0_0_3px_rgba(198,167,106,0.2)]">
            <Search aria-hidden="true" className="size-4 shrink-0 text-brand-text/60" strokeWidth={1.5} />
            <label htmlFor="not-found-q" className="sr-only">
              Search for a fragrance
            </label>
            <input id="not-found-q" type="search" name="q" maxLength={80} placeholder="Search for a fragrance" enterKeyHint="search" className="w-full min-w-0 bg-transparent text-[15px] text-brand-black placeholder:text-brand-text/50 focus:outline-none" />
            <button type="submit" className="h-9 shrink-0 rounded-full bg-brand-black px-4 text-[12px] font-medium tracking-[0.12em] text-white uppercase hover:bg-brand-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold">
              Search
            </button>
          </div>
        </form>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <PillLink href="/perfumes">Shop Perfumes</PillLink>
          <PillLink href="/best-sellers">Best sellers</PillLink>
        </div>
        <Link href="/" className="mt-8 text-[14px] font-medium text-brand-black underline decoration-brand-gold/70 underline-offset-4 hover:decoration-brand-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold">
          Back to the homepage
        </Link>
      </div>
    </main>
  );
}
