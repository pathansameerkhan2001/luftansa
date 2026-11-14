import { getAssetUrl } from "@/lib/assets";
import { collectionHref, isCatalogueProduct, productHref } from "@/lib/routes";
import { INSTAGRAM_PROFILE_URL, REELS, type Reel } from "@/data/reels";
import { InstagramGlyph } from "./InstagramGlyph";
import { ReelsCarousel, type ResolvedReel } from "./ReelsCarousel";

/**
 * Resolve each Reel's call to action:
 * - confirmed product + product page exists  -> "Shop Now" to that product
 * - else confirmed collection + page exists  -> "Explore Collection"
 * - otherwise no button (never a guessed or broken link)
 */
function resolveReel(reel: Reel): ResolvedReel {
  if (reel.productSlug && !isCatalogueProduct(reel.productSlug) && process.env.NODE_ENV !== "production") {
    console.warn(`[reels] "${reel.id}" references unknown product "${reel.productSlug}"; no Shop Now link shown.`);
  }
  const shop = productHref(reel.productSlug);
  const explore = shop ? undefined : collectionHref(reel.collectionSlug);
  const thumbSrc = reel.thumbnail?.key ? getAssetUrl(reel.thumbnail.key) : reel.thumbnail?.src;

  return {
    id: reel.id,
    title: reel.title,
    instagramUrl: reel.instagramUrl,
    thumbnail: thumbSrc ? { src: thumbSrc, alt: reel.thumbnail?.alt ?? reel.title } : undefined,
    cta: shop
      ? { kind: "shop", href: shop, label: "Shop Now" }
      : explore
        ? { kind: "collection", href: explore, label: "Explore Collection" }
        : undefined,
  };
}

/** "On Instagram / Luftansa Fragrance Moments" (Server Component). Hidden until Reels exist. */
export function InstagramReels({ reels = REELS }: { reels?: readonly Reel[] }) {
  if (reels.length === 0) return null;
  const items = reels.map(resolveReel);

  return (
    <section aria-labelledby="reels-heading" className="relative overflow-hidden bg-brand-ivory">
      {/* Soft silk-like sweep along the bottom edge. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[radial-gradient(120%_100%_at_50%_120%,rgba(198,167,106,0.18),rgba(198,167,106,0)_70%)]"
      />
      <div className="relative mx-auto max-w-[1600px] px-4 pt-14 pb-16 sm:px-8 sm:pt-20 sm:pb-20">
        <header className="mx-auto max-w-3xl text-center">
          <InstagramGlyph className="mx-auto size-9 sm:size-10" />
          <div className="mt-3 flex items-center justify-center gap-4 sm:gap-6">
            <span aria-hidden="true" className="h-px w-12 bg-gradient-to-r from-transparent to-brand-gold/80 min-[400px]:w-20 sm:w-40" />
            <p className="text-[11px] font-semibold tracking-[0.34em] whitespace-nowrap text-brand-black uppercase sm:text-[12px]">
              On Instagram
            </p>
            <span aria-hidden="true" className="h-px w-12 bg-gradient-to-l from-transparent to-brand-gold/80 min-[400px]:w-20 sm:w-40" />
          </div>
          <h2
            id="reels-heading"
            className="mt-2 font-serif text-[34px] leading-[1.08] font-semibold italic tracking-[-0.01em] text-balance text-brand-black min-[400px]:text-[38px] sm:text-[46px] lg:text-[54px]"
          >
            Luftansa Fragrance Moments
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[14.5px] leading-relaxed text-pretty text-brand-text/80 sm:text-[16px]">
            Reels, routines and real reviews from our Luftansa family.
          </p>
        </header>

        <div className="mt-10 sm:mt-12">
          <ReelsCarousel reels={items} />
        </div>

        {INSTAGRAM_PROFILE_URL ? (
          <div className="mt-10 flex justify-center sm:mt-12">
            <a
              href={INSTAGRAM_PROFILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-3 rounded-full bg-brand-black px-7 text-[14.5px] font-medium text-white ring-2 ring-brand-gold/70 transition-colors hover:bg-brand-text focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold"
            >
              <InstagramGlyph mono className="size-5" />
              Explore More on Instagram
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}
