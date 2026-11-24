import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { PerfumeBottleIcon } from "@/components/benefits/BenefitsStrip";
import { RollOnBottleIcon } from "./icons";
import { ProductCard, type ProductCardData } from "./ProductCard";

export const LISTING_IMAGE_SIZES = "(min-width: 1280px) 290px, (min-width: 1024px) 30vw, (min-width: 480px) 45vw, 90vw";

/** Product listing grid used by every listing page (one column on small phones, up to four on desktop). */
export function ProductGrid({ products, label }: { products: readonly ProductCardData[]; label: string }) {
  return (
    <ul className="mt-10 grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 sm:mt-12 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4" aria-label={label}>
      {products.map((p) => (
        <li key={p.slug} data-listing-product={p.slug}>
          <ProductCard product={p} imageSizes={LISTING_IMAGE_SIZES} />
        </li>
      ))}
    </ul>
  );
}

/** Empty listing: an elegant notice with a way onward (never a dead end). */
export function ListingEmpty({ text, kind = "spray", children }: { text: string; kind?: "spray" | "roll-on"; children?: ReactNode }) {
  const Icon = kind === "roll-on" ? RollOnBottleIcon : PerfumeBottleIcon;
  return (
    <div className="mx-auto mt-12 flex max-w-lg flex-col items-center rounded-[22px] bg-[radial-gradient(110%_80%_at_50%_30%,var(--brand-ivory)_0%,var(--brand-cream)_75%)] px-6 py-14 text-center ring-1 ring-brand-gold/20" data-listing-empty>
      <Icon aria-hidden="true" className="size-14 text-brand-gold/60" strokeWidth={0.75} />
      <p className="mt-5 max-w-xs font-serif text-[18px] leading-snug text-brand-text/80">{text}</p>
      {children}
    </div>
  );
}

/** Pill-shaped secondary link ("Shop Perfumes →"). */
export function PillLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-gold/50 bg-white/70 px-5 py-2.5 text-[12px] font-medium tracking-[0.16em] text-brand-black uppercase transition-colors hover:border-brand-gold hover:bg-brand-ivory focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
    >
      {children}
      <ArrowRight aria-hidden="true" className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" strokeWidth={1.75} />
    </Link>
  );
}

export function ListingCount({ count, noun = "fragrance" }: { count: number; noun?: string }) {
  if (!count) return null;
  return (
    <p className="mt-3 text-[12.5px] tracking-[0.08em] text-brand-text/60 uppercase" data-listing-count>
      {count} {count === 1 ? noun : `${noun}s`}
    </p>
  );
}
