import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { ProductCard } from "@/components/collection/ProductCard";
import { STORE_NAME } from "@/data/store";
import { SECTION_LABEL, SECTION_ROUTE } from "@/lib/catalogue/product-format";
import { getActiveStorefrontProducts, toStorefrontCardData } from "@/lib/storefront/products";
import { MAX_QUERY_LENGTH, searchProducts } from "@/lib/storefront/search";

export const metadata: Metadata = { title: `Search | ${STORE_NAME}`, robots: { index: false, follow: true } };

const SECTIONS = ["perfume", "roll-on"] as const;

/** Storefront search (the header search form submits here). Results are grouped into Perfumes and Roll-On. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const results = q ? searchProducts(await getActiveStorefrontProducts(), q) : [];
  const groups = SECTIONS.map((s) => ({ section: s, items: results.filter((p) => p.format === s).map(toStorefrontCardData) })).filter((g) => g.items.length > 0);
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <main className="bg-brand-cream" data-search-page>
      <div className="mx-auto max-w-7xl px-4 pt-8 pb-16 sm:px-8 sm:pt-10 sm:pb-24">
        <h1 className="text-center font-serif text-[36px] leading-tight font-semibold text-brand-black italic sm:text-[48px]">Search</h1>
        <form role="search" action="/search" method="get" className="mx-auto mt-6 max-w-xl">
          <div className="flex h-12 items-center gap-3 rounded-full border border-brand-gold/50 bg-white/80 px-5 focus-within:border-brand-gold focus-within:shadow-[0_0_0_3px_rgba(198,167,106,0.2)]">
            <Search aria-hidden="true" className="size-4 shrink-0 text-brand-text/60" strokeWidth={1.5} />
            <label htmlFor="search-page-q" className="sr-only">
              Search for products
            </label>
            <input
              id="search-page-q"
              type="search"
              name="q"
              defaultValue={q}
              maxLength={MAX_QUERY_LENGTH}
              autoComplete="off"
              enterKeyHint="search"
              placeholder="Fragrance, note or roll-on"
              className="w-full min-w-0 bg-transparent text-[15px] text-brand-black placeholder:text-brand-text/50 focus:outline-none"
            />
            <button type="submit" className="shrink-0 rounded-full bg-brand-black px-4 py-1.5 text-[12px] font-medium tracking-[0.12em] text-white uppercase hover:bg-brand-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold">
              Search
            </button>
          </div>
        </form>

        {q ? (
          <p className="mt-6 text-center text-[14px] text-brand-text/70" role="status" data-search-summary>
            {total === 0 ? (
              <>No fragrances match “{q}”.</>
            ) : (
              <>
                {total} {total === 1 ? "result" : "results"} for “{q}”
              </>
            )}
          </p>
        ) : (
          <p className="mt-6 text-center text-[14px] text-brand-text/70">Search by fragrance name, note (for example vanilla or oud) or format.</p>
        )}

        {groups.map((g) => (
          <section key={g.section} aria-labelledby={`search-${g.section}`} className="mt-12" data-search-group={g.section}>
            <div className="flex items-end justify-between gap-4 border-b border-brand-gold/30 pb-3">
              <h2 id={`search-${g.section}`} className="font-serif text-[26px] font-semibold text-brand-black sm:text-[30px]">
                {SECTION_LABEL[g.section]} <span className="text-[16px] font-normal text-brand-text/60">({g.items.length})</span>
              </h2>
              <Link href={SECTION_ROUTE[g.section]} className="text-[12.5px] font-medium tracking-[0.08em] text-brand-text/70 uppercase hover:text-brand-black hover:underline">
                View all {SECTION_LABEL[g.section].toLowerCase()}
              </Link>
            </div>
            <ul className="mt-6 grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
              {g.items.map((p) => (
                <li key={p.slug}>
                  <ProductCard product={p} imageSizes="(min-width: 1280px) 290px, (min-width: 1024px) 30vw, (min-width: 480px) 45vw, 90vw" />
                </li>
              ))}
            </ul>
          </section>
        ))}

        {q && total === 0 ? (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {SECTIONS.map((s) => (
              <Link key={s} href={SECTION_ROUTE[s]} className="rounded-full border border-brand-gold/50 bg-white/70 px-5 py-2.5 text-[12px] font-medium tracking-[0.16em] text-brand-black uppercase hover:border-brand-gold">
                Browse {SECTION_LABEL[s]}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  );
}
