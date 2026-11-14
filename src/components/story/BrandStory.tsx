import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getAssetUrl } from "@/lib/assets";
import { ABOUT_ROUTE } from "@/lib/routes";
import { BRAND_STORY, FRAME_ASPECT_RATIO, type StoryVideoConfig } from "@/data/brand-story";
import { Reveal } from "./Reveal";

const resolve = (asset?: { key?: string; src?: string }) =>
  asset?.key ? getAssetUrl(asset.key) : asset?.src;

/** Left column: the brand video, or an empty ivory frame of the same size. */
function StoryVideoFrame({ video }: { video?: StoryVideoConfig }) {
  const src = resolve(video);
  const poster = resolve(video?.poster);

  return (
    <div
      data-story-frame
      className="relative w-full overflow-hidden rounded-[22px] border border-brand-gold/50 bg-[radial-gradient(120%_90%_at_50%_40%,#fffdf8_0%,#f8f3e8_65%,#f1e8d7_100%)] transition-[clip-path] duration-[1200ms] ease-[cubic-bezier(0.22,0.8,0.3,1)] group-data-[reveal=armed]/reveal:[clip-path:inset(0_0_100%_0_round_22px)] [clip-path:inset(0_0_0_0_round_22px)]"
      style={{ aspectRatio: FRAME_ASPECT_RATIO }}
    >
      {src ? (
        <video
          className="absolute inset-0 size-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={poster}
          aria-label={video?.label}
        >
          <source src={src} type={video?.type ?? "video/mp4"} />
        </video>
      ) : (
        // Empty placeholder frame: intentionally no text, icons or controls.
        <span aria-hidden="true" className="absolute inset-3 rounded-[16px] border border-brand-gold/30 sm:inset-4" />
      )}
    </div>
  );
}

/** "Our Brand / The Luftansa Story" split section (Server Component). */
export function BrandStory() {
  const { label, heading, description, cta, video } = BRAND_STORY;
  const ctaClass =
    "group/cta mt-8 inline-flex items-center gap-2.5 border-b-2 border-brand-black pb-2 text-[12.5px] font-semibold tracking-[0.18em] text-brand-black uppercase sm:mt-9";

  return (
    <section aria-labelledby="brand-story-heading" className="bg-brand-ivory">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 py-16 sm:px-8 sm:py-20 md:gap-12 lg:grid-cols-2 lg:gap-16 lg:py-24 xl:gap-20">
        <Reveal className="mx-auto w-full max-w-[560px] lg:max-w-none">
          <StoryVideoFrame video={video} />
        </Reveal>

        <Reveal className="mx-auto max-w-xl text-center lg:mx-0 lg:justify-self-center">
          <div className="transition-[opacity,translate] duration-[900ms] ease-out group-data-[reveal=armed]/reveal:translate-y-5 group-data-[reveal=armed]/reveal:opacity-0">
            <p className="flex items-center justify-center gap-4 text-[11px] font-semibold tracking-[0.34em] text-brand-black uppercase sm:text-[12px]">
              <span aria-hidden="true" className="h-px w-10 bg-brand-gold/70 sm:w-14" />
              {label}
              <span aria-hidden="true" className="h-px w-10 bg-brand-gold/70 sm:w-14" />
            </p>
            <h2
              id="brand-story-heading"
              className="mt-4 font-serif text-[30px] leading-[1.12] font-semibold tracking-[0.05em] text-brand-black uppercase min-[400px]:text-[33px] sm:text-[38px] xl:text-[42px]"
            >
              {heading}
            </h2>

            {/* Gold divider with a small diamond accent. */}
            <div aria-hidden="true" className="mx-auto mt-5 flex items-center justify-center gap-3">
              <span className="h-px w-12 bg-gradient-to-r from-transparent to-brand-gold" />
              <span className="size-1.5 rotate-45 bg-brand-gold" />
              <span className="h-px w-12 bg-gradient-to-l from-transparent to-brand-gold" />
            </div>

            <p className="mx-auto mt-5 max-w-lg text-[14.5px] leading-[1.8] text-pretty text-brand-text/80 sm:text-[15.5px]">
              {description}
            </p>

            {ABOUT_ROUTE ? (
              <Link
                href={ABOUT_ROUTE}
                className={`${ctaClass} transition-colors hover:border-brand-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold`}
              >
                {cta}
                <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover/cta:translate-x-1" strokeWidth={1.75} />
              </Link>
            ) : (
              // The About page does not exist yet: same design, no broken link.
              // Set ABOUT_ROUTE in src/lib/routes.ts once the page is built.
              <span aria-disabled="true" className={`${ctaClass} cursor-default`}>
                {cta}
                <span className="sr-only">(coming soon)</span>
                <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.75} />
              </span>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
