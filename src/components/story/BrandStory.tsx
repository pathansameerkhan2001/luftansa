import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getAssetUrl } from "@/lib/assets";
import { loadPublished } from "@/lib/cms/loader";
import { BRAND_STORY_DEFAULT, BRAND_STORY_MODULE, resolveBrandStory, type BrandStoryView as View } from "@/lib/cms/modules/brand-story";
import { Reveal } from "./Reveal";

const BACKGROUND: Record<View["background"], string> = {
  ivory: "bg-brand-ivory",
  cream: "bg-brand-cream",
  white: "bg-white",
};

/** Staggered fade + rise for each line of the story (only while the Reveal is armed; static otherwise). */
const rise = (delay: string) =>
  `transition-[opacity,translate] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${delay} group-data-[reveal=armed]/reveal:translate-y-4 group-data-[reveal=armed]/reveal:opacity-0`;

/** Portrait image in a fine gold frame, or the ivory placeholder frame when no image is set. */
function StoryImage({ image }: { image?: View["image"] }) {
  return (
    <div
      data-story-frame
      className="group/img relative aspect-[4/5] w-full overflow-hidden rounded-[24px] border border-brand-gold/50 bg-[radial-gradient(120%_90%_at_50%_40%,#fffdf8_0%,#f8f3e8_65%,#f1e8d7_100%)] transition-[clip-path] duration-[1200ms] ease-[cubic-bezier(0.22,0.8,0.3,1)] [clip-path:inset(0_0_0_0_round_24px)] group-data-[reveal=armed]/reveal:[clip-path:inset(0_0_100%_0_round_24px)]"
    >
      {image ? (
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes="(min-width: 1280px) 560px, (min-width: 1024px) 46vw, (min-width: 640px) 560px, 92vw"
          className="object-cover transition-[transform,opacity] duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[reveal=armed]/reveal:scale-[1.04] group-data-[reveal=armed]/reveal:opacity-0 motion-safe:group-hover/img:scale-[1.03]"
          style={{ objectPosition: image.position }}
          data-story-image
        />
      ) : null}
      {/* Inner gold line (decorative). */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-3 rounded-[18px] border border-brand-gold/30 sm:inset-4" />
    </div>
  );
}

function StoryCta({ cta }: { cta: NonNullable<View["cta"]> }) {
  const base =
    "group/cta mt-8 inline-flex min-h-11 items-center gap-2.5 border-b-2 border-brand-black pb-2 text-[12.5px] font-semibold tracking-[0.18em] text-brand-black uppercase sm:mt-9";
  const interactive = `${base} transition-colors duration-300 hover:border-brand-gold hover:text-[#5E4720] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold`;
  const arrow = <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-300 group-hover/cta:translate-x-1 motion-reduce:transition-none" strokeWidth={1.75} />;
  if (!cta.href) {
    // No destination yet: same design, never a broken link.
    return (
      <span aria-disabled="true" className={`${base} cursor-default`} data-story-cta="text">
        {cta.label}
        <span className="sr-only">(coming soon)</span>
        <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.75} />
      </span>
    );
  }
  if (cta.href.startsWith("/")) {
    return (
      <Link href={cta.href} className={interactive} data-story-cta="link">
        {cta.label}
        {arrow}
      </Link>
    );
  }
  return (
    <a href={cta.href} target="_blank" rel="noopener noreferrer" className={interactive} data-story-cta="link">
      {cta.label}
      <span className="sr-only">(opens in a new tab)</span>
      {arrow}
    </a>
  );
}

/** "Our Brand / The Luftansa Story" split section (used by the homepage and the admin preview). */
export function BrandStoryView({ view }: { view: View }) {
  const imageRight = view.imagePosition === "right";
  return (
    <section aria-labelledby="brand-story-heading" className={BACKGROUND[view.background]} data-brand-story data-image-position={view.imagePosition}>
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 py-16 sm:px-8 sm:py-20 md:gap-12 lg:grid-cols-2 lg:gap-16 lg:py-24 xl:gap-20">
        <Reveal className={`mx-auto w-full max-w-[560px] lg:max-w-none ${imageRight ? "lg:order-2" : ""}`}>
          <StoryImage image={view.image} />
        </Reveal>

        <Reveal className={`mx-auto max-w-xl text-center lg:mx-0 lg:justify-self-center ${imageRight ? "lg:order-1" : ""}`}>
          <p className={`flex items-center justify-center gap-4 text-[11px] font-semibold tracking-[0.34em] text-brand-black uppercase sm:text-[12px] ${rise("delay-100")}`}>
            <span aria-hidden="true" className="h-px w-10 bg-brand-gold/70 sm:w-14" />
            {view.eyebrow}
            <span aria-hidden="true" className="h-px w-10 bg-brand-gold/70 sm:w-14" />
          </p>
          <h2
            id="brand-story-heading"
            className={`mt-4 font-serif text-[30px] leading-[1.12] font-semibold tracking-[0.05em] text-balance text-brand-black uppercase min-[400px]:text-[33px] sm:text-[38px] xl:text-[42px] ${rise("delay-200")}`}
          >
            {view.heading}
          </h2>

          {/* Gold divider with a small diamond accent. */}
          <div aria-hidden="true" className={`mx-auto mt-5 flex items-center justify-center gap-3 ${rise("delay-300")}`}>
            <span className="h-px w-12 bg-gradient-to-r from-transparent to-brand-gold" />
            <span className="size-1.5 rotate-45 bg-brand-gold" />
            <span className="h-px w-12 bg-gradient-to-l from-transparent to-brand-gold" />
          </div>

          <div className={rise("delay-300")}>
            {view.paragraphs.map((p, i) => (
              <p key={i} className="mx-auto mt-5 max-w-lg text-[14.5px] leading-[1.8] text-pretty text-brand-text/80 sm:text-[15.5px]">
                {p}
              </p>
            ))}
          </div>

          {view.cta ? (
            <div className={rise("delay-500")}>
              <StoryCta cta={view.cta} />
            </div>
          ) : null}
        </Reveal>
      </div>
    </section>
  );
}

/**
 * Homepage Brand Story (Server Component), managed in Admin → Brand Story.
 * Removed entirely (no gap) when deactivated; default content until published.
 */
export async function BrandStory() {
  let view: View | null;
  try {
    view = resolveBrandStory(await loadPublished(BRAND_STORY_MODULE, [BRAND_STORY_DEFAULT]), getAssetUrl);
  } catch (e) {
    console.error("[brand-story] could not be loaded; showing the default content:", (e as Error).message);
    view = resolveBrandStory({ source: "fallback", items: [{ payload: BRAND_STORY_DEFAULT }] }, getAssetUrl);
  }
  return view ? <BrandStoryView view={view} /> : null;
}
