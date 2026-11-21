import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PerfumeBottleIcon } from "@/components/benefits/BenefitsStrip";
import { DEFAULT_ROLL_ON_SIZE_ML, SECTION_LABEL, SECTION_ROUTE } from "@/lib/catalogue/product-format";
import { sortByDisplayOrder } from "@/lib/storefront/collections";
import { getActiveStorefrontProducts, toStorefrontCardData } from "@/lib/storefront/products";
import { FlourishIcon, RollOnBottleIcon } from "./icons";
import { ProductCard } from "./ProductCard";

type Section = "perfume" | "roll-on";

const COPY: Record<Section, { eyebrow: string; intro: string; empty: string; other: Section; otherPrompt: string }> = {
  perfume: {
    eyebrow: "Eau de parfum sprays",
    intro: "Every Luftansa fragrance in a spray bottle, in 30 ml, 50 ml and 100 ml.",
    empty: "No perfumes are available right now. Please check back soon.",
    other: "roll-on",
    otherPrompt: "Prefer something pocket-sized?",
  },
  "roll-on": {
    eyebrow: "Travel-friendly roll-ons",
    intro: `Our fragrances in a convenient ${DEFAULT_ROLL_ON_SIZE_ML} ml roll-on, for your bag, desk or travels.`,
    empty: "No roll-ons are available right now. Please check back soon.",
    other: "perfume",
    otherPrompt: "Looking for a full-size bottle?",
  },
};

/**
 * Storefront listing of one product section (Server Component): Perfumes
 * (spray products only) or Roll-On (Roll-On products only). Active products,
 * in the admin display order.
 */
export async function SectionListing({ section }: { section: Section }) {
  const copy = COPY[section];
  const products = sortByDisplayOrder((await getActiveStorefrontProducts()).filter((p) => p.format === section)).map(toStorefrontCardData);
  const title = SECTION_LABEL[section];
  const EmptyIcon = section === "roll-on" ? RollOnBottleIcon : PerfumeBottleIcon;

  return (
    <main className="bg-brand-cream" data-section-listing={section}>
      <div className="mx-auto max-w-7xl px-4 pt-6 pb-16 sm:px-8 sm:pt-8 sm:pb-24">
        <nav aria-label="Breadcrumb" className="text-[12.5px] text-brand-text/65">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-brand-black hover:underline">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-brand-black">
              {title}
            </li>
          </ol>
        </nav>

        <header className="mx-auto mt-8 max-w-2xl text-center sm:mt-10">
          <span aria-hidden="true" className="inline-flex text-brand-gold">
            <FlourishIcon className="size-9 sm:size-10" />
          </span>
          <p className="mt-3 flex items-center justify-center gap-4 text-[11px] font-medium tracking-[0.32em] text-brand-black uppercase sm:gap-6 sm:text-[12px]">
            <span aria-hidden="true" className="h-px w-10 bg-brand-gold/70 sm:w-20" />
            {copy.eyebrow}
            <span aria-hidden="true" className="h-px w-10 bg-brand-gold/70 sm:w-20" />
          </p>
          <h1 className="mt-3 font-serif text-[40px] leading-[1.08] font-semibold tracking-[-0.01em] text-brand-black italic min-[400px]:text-[44px] sm:text-[56px]">{title}</h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-pretty text-brand-text/80 sm:text-[17px]">{copy.intro}</p>
          {products.length ? (
            <p className="mt-3 text-[12.5px] tracking-[0.08em] text-brand-text/60 uppercase" data-listing-count>
              {products.length} {products.length === 1 ? "fragrance" : "fragrances"}
            </p>
          ) : null}
        </header>

        {products.length ? (
          <ul className="mt-10 grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 sm:mt-12 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4" aria-label={`${title}`}>
            {products.map((p) => (
              <li key={p.slug} data-listing-product={p.slug}>
                <ProductCard product={p} imageSizes="(min-width: 1280px) 290px, (min-width: 1024px) 30vw, (min-width: 480px) 45vw, 90vw" />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mx-auto mt-12 flex max-w-lg flex-col items-center rounded-[22px] bg-[radial-gradient(110%_80%_at_50%_30%,var(--brand-ivory)_0%,var(--brand-cream)_75%)] px-6 py-14 text-center ring-1 ring-brand-gold/20" data-listing-empty>
            <EmptyIcon aria-hidden="true" className="size-14 text-brand-gold/60" strokeWidth={0.75} />
            <p className="mt-5 max-w-xs font-serif text-[18px] leading-snug text-brand-text/80">{copy.empty}</p>
          </div>
        )}

        <div className="mt-14 flex flex-col items-center gap-3 text-center sm:mt-16">
          <p className="font-serif text-[18px] text-brand-text/80 sm:text-[20px]">{copy.otherPrompt}</p>
          <Link
            href={SECTION_ROUTE[copy.other]}
            className="group inline-flex items-center gap-2 rounded-full border border-brand-gold/50 bg-white/70 px-5 py-2.5 text-[12px] font-medium tracking-[0.16em] text-brand-black uppercase transition-colors hover:border-brand-gold hover:bg-brand-ivory focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
          >
            Shop {SECTION_LABEL[copy.other]}
            <ArrowRight aria-hidden="true" className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" strokeWidth={1.75} />
          </Link>
        </div>
      </div>
    </main>
  );
}
