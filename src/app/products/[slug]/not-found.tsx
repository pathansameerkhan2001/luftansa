import Link from "next/link";
import { PerfumeBottleIcon } from "@/components/benefits/BenefitsStrip";

/** Shown for unknown or inactive product slugs. */
export default function ProductNotFound() {
  return (
    <main className="bg-brand-ivory">
      <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center sm:py-28">
        <PerfumeBottleIcon aria-hidden="true" className="size-16 text-brand-gold/70" strokeWidth={0.75} />
        <p className="mt-6 text-[11px] font-medium tracking-[0.32em] text-brand-text/60 uppercase">Error 404</p>
        <h1 className="mt-3 font-serif text-[36px] leading-tight font-semibold italic text-brand-black sm:text-[44px]">
          Fragrance not found
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-brand-text/75">
          This fragrance may no longer be available, or the link may be incorrect.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-brand-black px-7 text-[15px] font-semibold text-white transition-colors hover:bg-brand-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
        >
          Explore our fragrances
        </Link>
      </div>
    </main>
  );
}
