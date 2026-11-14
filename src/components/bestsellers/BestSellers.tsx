import Image from "next/image";
import { FlourishIcon } from "@/components/collection/icons";
import { HERO_BANNER } from "@/components/hero/hero-banner";
import { getAssetUrl } from "@/lib/assets";
import { BEST_SELLER_SLUGS, getProductsBySlugs, priceForSize } from "@/data/products";
import { FRAGRANCE_PROFILES, getNoteImage, type NoteTier } from "@/data/fragrance-profiles";
import { BestSellersShowcase, type BestSellerItem } from "./BestSellersShowcase";

const TIERS: readonly NoteTier[] = ["top", "middle", "base"];

function buildItems(): BestSellerItem[] {
  return getProductsBySlugs(BEST_SELLER_SLUGS).map((product) => {
    const profile = FRAGRANCE_PROFILES[product.slug] ?? {};
    return {
      slug: product.slug,
      name: product.name,
      // Spray perfumes: confirmed sizes at the standard price list.
      options: product.sizes.map((ml) => ({ id: `${ml}ml`, label: `${ml} ml`, priceInr: priceForSize(ml) })),
      image: product.image
        ? { src: getAssetUrl(product.image.key), alt: product.image.alt, objectPosition: product.image.objectPosition }
        : undefined,
      perfectFor: profile.perfectFor,
      description: profile.description,
      notes: TIERS.map((tier) => {
        const name = profile.notes?.[tier];
        return { tier, name, image: name ? getNoteImage(name) : undefined };
      }),
    };
  });
}

/** Leafy branch silhouette, blurred into a soft botanical shadow. */
function LeafShadow({ className }: { className?: string }) {
  const leaves = [
    [70, 60, -35], [120, 95, -20], [95, 150, -50], [165, 140, -10], [150, 205, -40],
    [215, 190, 5], [200, 255, -30], [265, 245, 15], [255, 305, -20], [310, 300, 25],
  ];
  return (
    <svg viewBox="0 0 380 380" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M20 10 C 120 120, 220 220, 360 370" stroke="currentColor" strokeWidth="4" fill="none" />
      {leaves.map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx="34" ry="12" transform={`rotate(${r} ${x} ${y})`} />
      ))}
    </svg>
  );
}

/** "Best Sellers / Find Your Personality" homepage section (Server Component). */
export function BestSellers() {
  const items = buildItems();
  if (items.length === 0) return null;
  const textureSrc = HERO_BANNER.key ? getAssetUrl(HERO_BANNER.key) : HERO_BANNER.src;

  return (
    <section aria-labelledby="best-sellers-heading" className="relative isolate overflow-hidden bg-brand-cream">
      {/* Subtle photographic texture: the hero's ivory silk, heavily softened. */}
      {textureSrc ? (
        <Image
          src={textureSrc}
          alt=""
          fill
          sizes="100vw"
          quality={55}
          className="-z-20 object-cover opacity-[0.34] saturate-[0.85]"
        />
      ) : null}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_50%_45%,rgba(255,253,248,0.9)_0%,rgba(255,253,248,0.55)_55%,rgba(248,245,236,0.2)_100%)]"
      />
      <LeafShadow className="pointer-events-none absolute -top-10 -left-16 -z-10 w-[260px] text-[#b8976a] opacity-[0.18] blur-[3px] sm:w-[380px]" />
      <svg
        aria-hidden="true"
        viewBox="0 0 400 220"
        fill="none"
        className="pointer-events-none absolute -top-6 -right-10 -z-10 hidden w-[420px] text-brand-gold opacity-60 md:block"
      >
        <path d="M10 10 C 150 40, 260 120, 395 200" stroke="currentColor" strokeWidth="2.5" />
        <path d="M40 0 C 170 30, 280 100, 400 160" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
      </svg>

      <div className="mx-auto max-w-[1440px] px-4 pt-14 pb-16 sm:px-8 sm:pt-20 sm:pb-24">
        <header className="mx-auto max-w-3xl text-center">
          <div aria-hidden="true" className="flex items-center justify-center gap-4 text-brand-gold sm:gap-6">
            <span className="h-px w-16 bg-gradient-to-r from-transparent to-brand-gold/80 min-[400px]:w-24 sm:w-48" />
            <FlourishIcon className="size-8 shrink-0 sm:size-9" />
            <span className="h-px w-16 bg-gradient-to-l from-transparent to-brand-gold/80 min-[400px]:w-24 sm:w-48" />
          </div>
          <p className="mt-3 text-[12px] font-semibold tracking-[0.3em] text-brand-black uppercase sm:text-[13px]">
            Best Sellers
          </p>
          <h2
            id="best-sellers-heading"
            className="mt-1 font-serif text-[40px] leading-[1.08] font-semibold italic tracking-[-0.01em] text-brand-black min-[400px]:text-[44px] sm:text-[54px] lg:text-[62px]"
          >
            Find Your Personality
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-pretty text-brand-text/80 sm:text-[17px]">
            Five Luftansa signatures, each made for a different mood. Pick one to see its notes, its moment and its
            sizes.
          </p>
        </header>

        <div className="mt-10 sm:mt-14">
          <BestSellersShowcase items={items} />
        </div>
      </div>
    </section>
  );
}
