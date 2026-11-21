import Image from "next/image";
import { Reveal } from "@/components/motion/Reveal";
import type { OurStoryView as View, StoryImageView } from "@/lib/cms/modules/our-story";

/** Gold hairline used as a small editorial accent. */
function Rule({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`block h-px w-14 bg-brand-gold ${className}`} />;
}

function Photo({ image, sizes, className, priority }: { image: StoryImageView; sizes: string; className: string; priority?: boolean }) {
  return (
    <div className={`relative overflow-hidden bg-brand-cream ${className}`}>
      <Image src={image.src} alt={image.alt} fill sizes={sizes} priority={priority} className="object-cover" style={{ objectPosition: image.position }} />
    </div>
  );
}

/* ------------------------------------------------------------------ hero --- */

function Hero({ hero }: { hero: NonNullable<View["hero"]> }) {
  const { lines, supporting, image } = hero;
  return (
    <section aria-labelledby="our-story-hero-heading" className="bg-[#f6f3ec]" data-story-hero>
      <div className={`mx-auto grid max-w-[1600px] ${image ? "lg:min-h-[640px] lg:grid-cols-2 xl:min-h-[720px]" : ""}`}>
        <div className={`flex flex-col justify-center px-5 py-14 sm:px-10 sm:py-20 lg:px-12 xl:px-16 2xl:px-24 ${image ? "" : "items-center text-center"}`}>
          <Reveal>
            <Rule className={image ? "" : "mx-auto"} />
            <h1 id="our-story-hero-heading" className="mt-6 font-serif text-[40px] leading-[1.02] font-semibold tracking-[0.01em] text-brand-black uppercase min-[400px]:text-[46px] sm:text-[60px] lg:text-[48px] xl:text-[56px] 2xl:text-[72px]">
              {lines.map((line, i) => (
                <span key={i} className="block" data-headline-line>
                  {line}
                </span>
              ))}
            </h1>
            {supporting ? <p className={`mt-6 max-w-md font-serif text-[18px] leading-relaxed text-brand-text/80 italic sm:text-[20px] ${image ? "" : "mx-auto"}`}>{supporting}</p> : null}
          </Reveal>
        </div>
        {image ? <Photo image={image} priority sizes="(min-width: 1024px) 50vw, 100vw" className="aspect-[4/3] w-full sm:aspect-[16/10] lg:aspect-auto lg:h-full" /> : null}
      </div>
    </section>
  );
}

/* ------------------------------------------------------- why we started --- */

function Why({ why }: { why: NonNullable<View["why"]> }) {
  const { title, heading, image, blocks, closing, attribution } = why;
  return (
    <section aria-labelledby="our-story-why-heading" className="bg-brand-ivory" data-story-why>
      <div
        className={`mx-auto grid max-w-[1400px] gap-10 px-5 py-16 sm:px-10 sm:py-24 lg:gap-14 ${
          image ? "md:grid-cols-2 xl:grid-cols-[0.8fr_1.15fr_1.35fr] xl:items-center" : "lg:grid-cols-[0.8fr_1.6fr] lg:items-start"
        }`}
      >
        <Reveal className={image ? "md:col-span-2 xl:col-span-1" : ""}>
          <Rule />
          <h2 id="our-story-why-heading" className="mt-5 font-serif text-[40px] leading-[1.05] font-semibold text-brand-black sm:text-[48px] xl:text-[54px]">
            {title}
          </h2>
        </Reveal>

        {image ? (
          <Reveal delayMs={100}>
            <Photo image={image} sizes="(min-width: 1280px) 30vw, (min-width: 768px) 46vw, 100vw" className="aspect-[4/5] w-full rounded-[4px]" />
          </Reveal>
        ) : null}

        <Reveal delayMs={180}>
          <p className="font-serif text-[27px] leading-[1.15] font-semibold text-brand-black sm:text-[32px]">{heading}</p>
          <div className="mt-8 space-y-8">
            {blocks.map((b) => (
              <div key={b.number} data-story-block>
                <h3 className="text-[16.5px] font-semibold text-brand-black">
                  {b.number}. {b.heading}
                </h3>
                {b.description ? <p className="mt-1 text-[15.5px] leading-relaxed text-brand-text/80">{b.description}</p> : null}
                {b.points.length ? (
                  <ul className="mt-3.5 space-y-1.5">
                    {b.points.map((pt) => (
                      <li key={pt} className="flex gap-3 text-[15.5px] leading-relaxed text-brand-text/80">
                        <span aria-hidden="true" className="mt-[0.8em] h-px w-3 shrink-0 bg-brand-gold" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
          {closing.length ? (
            <div className="mt-8 space-y-1 text-[15.5px] leading-relaxed text-brand-black" data-story-closing>
              {closing.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          ) : null}
          {attribution ? <p className="mt-6 text-[15.5px] font-semibold text-brand-black" data-story-attribution>— {attribution}</p> : null}
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- journey --- */

function Journey({ journey }: { journey: NonNullable<View["journey"]> }) {
  const { heading, subtitle, steps } = journey;
  const anyImage = steps.some((s) => s.image);
  const columns = Math.min(steps.length, 5);
  return (
    <section aria-labelledby="our-story-journey-heading" className="bg-[#f6f3ec]" data-story-journey>
      <div className="mx-auto max-w-[1600px] px-5 py-16 sm:px-10 sm:py-24">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 id="our-story-journey-heading" className="font-serif text-[36px] leading-[1.08] font-semibold text-balance text-brand-black sm:text-[48px] xl:text-[56px]">
            {heading}
          </h2>
          {subtitle ? <p className="mx-auto mt-4 max-w-xl font-serif text-[18px] leading-relaxed text-brand-text/75 italic sm:text-[20px]">{subtitle}</p> : null}
        </Reveal>

        <Reveal delayMs={120} className="mt-10 sm:mt-14">
          <ol
            className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-3 [scrollbar-width:thin] sm:-mx-10 sm:scroll-px-10 sm:gap-5 sm:px-10 lg:mx-0 lg:grid lg:snap-none lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:h-1"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            aria-label="Our journey, step by step"
            data-journey-track
          >
            {steps.map((s) => (
              <li key={s.number} className="flex w-[78%] max-w-[340px] shrink-0 snap-start flex-col sm:w-[44%] lg:w-auto lg:max-w-none" data-journey-step={s.number}>
                {s.image ? (
                  <Photo image={s.image} sizes="(min-width: 1024px) 19vw, (min-width: 640px) 44vw, 78vw" className="aspect-square w-full" />
                ) : anyImage ? (
                  <div aria-hidden="true" className="flex aspect-square w-full items-center justify-center bg-[radial-gradient(120%_90%_at_50%_30%,#3a3632_0%,#25231f_100%)]">
                    <span className="font-serif text-[88px] leading-none text-brand-gold/70 italic">{s.number}</span>
                  </div>
                ) : null}
                <div className="flex flex-1 flex-col items-center bg-[#2b2926] px-5 pt-6 pb-7 text-center text-white">
                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-white text-[13px] font-bold text-[#7a1d1d]" aria-hidden="true">
                    {s.number}
                  </span>
                  {s.period ? <p className="mt-2 text-[13px] font-semibold tracking-[0.02em] text-white">{s.period}</p> : null}
                  <h3 className="mt-4 font-serif text-[24px] leading-[1.15] font-medium text-balance text-white sm:text-[26px]">{s.title}</h3>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-white/70">{s.description}</p>
                  {s.caption ? <p className="mt-3 font-serif text-[14.5px] text-[#e6c27a] italic">{s.caption}</p> : null}
                </div>
              </li>
            ))}
          </ol>
          {steps.length > 1 ? <p className="mt-3 text-center text-[12.5px] tracking-[0.12em] text-brand-text/55 uppercase lg:hidden">Swipe to see every step</p> : null}
        </Reveal>
      </div>
    </section>
  );
}

/** The Our Story page (also used by the admin preview). Disabled sections are left out. */
export function OurStoryView({ view }: { view: View }) {
  return (
    <div data-our-story>
      {view.hero ? <Hero hero={view.hero} /> : null}
      {view.why ? <Why why={view.why} /> : null}
      {view.journey ? <Journey journey={view.journey} /> : null}
    </div>
  );
}
