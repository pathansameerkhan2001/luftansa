import { Reveal } from "@/components/motion/Reveal";
import { getAssetUrl } from "@/lib/assets";
import { loadPublished } from "@/lib/cms/loader";
import { REELS_MODULE, REELS_SECTION_DEFAULT, REELS_SECTION_MODULE, resolveReelsSection, type ReelsSectionView } from "@/lib/cms/modules/reels";
import { productHref } from "@/lib/routes";
import { getActiveStorefrontProducts } from "@/lib/storefront/products";
import { InstagramGlyph } from "./InstagramGlyph";
import { ReelsCarousel } from "./ReelsCarousel";

/** Loads the section from the CMS. null (section hidden) on any problem: never a broken or empty section. */
async function loadReelsSection(): Promise<ReelsSectionView | null> {
  try {
    const [section, reels, products] = await Promise.all([
      loadPublished(REELS_SECTION_MODULE, [REELS_SECTION_DEFAULT]),
      loadPublished(REELS_MODULE, []),
      getActiveStorefrontProducts(),
    ]);
    const active = new Map(products.flatMap((p) => {
      const href = productHref(p.slug);
      return href ? [[p.slug, { href, name: p.displayName }] as const] : [];
    }));
    return resolveReelsSection(section, reels, getAssetUrl, active);
  } catch (e) {
    console.error("[reels] section could not be loaded; hidden:", (e as Error).message);
    return null;
  }
}

/**
 * "On Instagram" Reels section (Server Component), managed in Admin →
 * Instagram Reels. Hidden when the section is deactivated, when no Reel is
 * active, or when the content cannot be loaded.
 */
export async function InstagramReels() {
  const view = await loadReelsSection();
  if (!view) return null;

  return (
    <section aria-labelledby="reels-heading" className="relative overflow-hidden bg-brand-ivory" data-reels-section>
      {/* Soft silk-like sweep along the bottom edge. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-[radial-gradient(120%_100%_at_50%_120%,rgba(198,167,106,0.2),rgba(198,167,106,0)_70%)]"
      />
      <div className="relative mx-auto max-w-[1440px] px-4 pt-16 pb-16 sm:px-10 sm:pt-24 sm:pb-24">
        <Reveal className="mx-auto max-w-3xl text-center">
          <header>
            <InstagramGlyph className="mx-auto size-9 sm:size-10" />
            <div className="mt-3 flex items-center justify-center gap-4 sm:gap-6">
              <span aria-hidden="true" className="h-px w-12 bg-gradient-to-r from-transparent to-brand-gold/80 min-[400px]:w-20 sm:w-40" />
              <p className="text-[11px] font-semibold tracking-[0.34em] whitespace-nowrap text-brand-black uppercase sm:text-[12px]">On Instagram</p>
              <span aria-hidden="true" className="h-px w-12 bg-gradient-to-l from-transparent to-brand-gold/80 min-[400px]:w-20 sm:w-40" />
            </div>
            <h2
              id="reels-heading"
              className="mt-2 font-serif text-[34px] leading-[1.08] font-semibold tracking-[-0.01em] text-balance text-brand-black italic min-[400px]:text-[38px] sm:text-[46px] lg:text-[54px]"
            >
              {view.heading}
            </h2>
            {view.subtitle ? (
              <p className="mx-auto mt-3 max-w-xl text-[14.5px] leading-relaxed text-pretty text-brand-text/80 sm:text-[16px]">{view.subtitle}</p>
            ) : null}
          </header>
        </Reveal>

        <div className="mt-10 sm:mt-14">
          <ReelsCarousel reels={view.reels} />
        </div>

        {view.instagramProfileUrl ? (
          <Reveal className="mt-10 flex justify-center sm:mt-12">
            <a
              href={view.instagramProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-3 rounded-full bg-brand-black px-7 text-[14.5px] font-medium text-white ring-2 ring-brand-gold/70 transition-colors hover:bg-brand-text focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold"
              data-reels-profile
            >
              <InstagramGlyph mono className="size-5" />
              Explore More on Instagram
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}
