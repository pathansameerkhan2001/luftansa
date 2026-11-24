import Link from "next/link";
import { getImageProps } from "next/image";
import { ArrowRight } from "lucide-react";
import type { CSSProperties } from "react";
import { MOBILE_MAX_WIDTH_PX } from "@/lib/cms/fields";
import type { HeroView } from "@/lib/cms/modules/hero";
import { HeroVideo } from "./HeroVideo";

/** 1×1 transparent GIF: the <source> a <picture> resolves to on the breakpoint where it is hidden, so it downloads nothing real. */
const BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const PHONE = `(max-width: ${MOBILE_MAX_WIDTH_PX}px)`;
const WIDER = `(min-width: ${MOBILE_MAX_WIDTH_PX + 1}px)`;

function HeroImage({ src, alt, position, hideOn, priority }: { src: string; alt: string; position: string; hideOn?: "phone" | "wider"; priority: boolean }) {
  const { props } = getImageProps({ src, alt, fill: true, sizes: "100vw", quality: 80, priority });
  const img = (
    // eslint-disable-next-line @next/next/no-img-element -- art-directed <picture> needs a plain <img> (props come from next/image getImageProps)
    <img {...props} alt={alt} className="object-cover" style={{ ...props.style, objectPosition: position }} />
  );
  if (!hideOn) return img;
  // Art direction: on the other breakpoint this picture resolves to a blank GIF
  // (nothing real is downloaded) and is display:none (removed from the
  // accessibility tree), so each device announces only the alt text of the
  // image it actually shows.
  return (
    <picture className={hideOn === "phone" ? "hidden sm:contents" : "contents sm:hidden"}>
      <source media={hideOn === "phone" ? PHONE : WIDER} srcSet={BLANK} />
      {img}
    </picture>
  );
}

/**
 * Space reserved for a fitted hero image until it loads. Only the ratio
 * matters: once loaded, the box follows the image's own aspect ratio
 * (`height: auto`). Desktop banners are typically 16:9; phone banners portrait.
 */
const RESERVE_WIDER = { width: 1600, height: 900 };
const RESERVE_PHONE = { width: 1080, height: 1350 };

/**
 * Image-only hero: the whole banner is always visible, never cropped or
 * stretched. The box takes the image's natural aspect ratio. On large
 * screens the height is capped so the hero never dominates the page; the
 * image is then scaled down (object-contain, centred) and a blurred copy of
 * itself fills the sides instead of empty bars.
 */
function FittedHeroImage({ src, alt, hideOn, priority }: { src: string; alt: string; hideOn?: "phone" | "wider"; priority: boolean }) {
  const reserve = hideOn === "wider" ? RESERVE_PHONE : RESERVE_WIDER;
  const { props } = getImageProps({ src, alt, ...reserve, sizes: "100vw", quality: 80, priority });
  const img = (
    // eslint-disable-next-line @next/next/no-img-element -- art-directed <picture> needs a plain <img> (props come from next/image getImageProps)
    <img {...props} alt={alt} className="relative block h-auto w-full object-contain object-center lg:max-h-[min(80vh,860px)]" />
  );
  if (!hideOn) return img;
  return (
    <picture className={hideOn === "phone" ? "hidden sm:contents" : "contents sm:hidden"}>
      <source media={hideOn === "phone" ? PHONE : WIDER} srcSet={BLANK} />
      {img}
    </picture>
  );
}

/** Soft blurred fill behind a height-capped desktop banner (decorative; tiny, lazily loaded, never on phones). */
function HeroBackdrop({ src }: { src: string }) {
  const { props } = getImageProps({ src, alt: "", width: 96, height: 54, quality: 50 });
  return (
    // eslint-disable-next-line @next/next/no-img-element -- decorative backdrop built from next/image getImageProps
    <img
      {...props}
      alt=""
      aria-hidden="true"
      loading="lazy"
      className="pointer-events-none absolute inset-0 hidden h-full w-full scale-110 object-cover blur-2xl lg:block"
    />
  );
}

/**
 * CMS hero (Server Component): full-width image with optional muted video,
 * heading, subtitle and button.
 *   - Image only (no text): the full banner is shown at its own aspect ratio
 *     (nothing cropped), see FittedHeroImage.
 *   - With text: the original fixed boxes with a cover-cropped photo, so the
 *     overlaid text always has room.
 */
export function HeroBanner({ view, className = "", priority = true }: { view: HeroView; className?: string; priority?: boolean }) {
  const { desktop, mobile, heading, subtitle, cta } = view;
  const sameImage = desktop.imageSrc === mobile.imageSrc && desktop.alt === mobile.alt;
  const hasText = Boolean(heading || subtitle || cta);
  const internal = cta?.href.startsWith("/");

  if (!hasText) {
    return (
      <section aria-label="Luftansa Fragrances" className={`relative w-full bg-brand-cream ${className}`} data-hero="cms">
        <div className="relative w-full overflow-hidden">
          <HeroBackdrop src={desktop.imageSrc} />
          {sameImage ? (
            <FittedHeroImage src={desktop.imageSrc} alt={desktop.alt} priority={priority} />
          ) : (
            <>
              <FittedHeroImage src={desktop.imageSrc} alt={desktop.alt} hideOn="phone" priority={priority} />
              <FittedHeroImage src={mobile.imageSrc} alt={mobile.alt} hideOn="wider" priority={priority} />
            </>
          )}
          {desktop.videoSrc || mobile.videoSrc ? (
            <HeroVideo desktopSrc={desktop.videoSrc} mobileSrc={mobile.videoSrc} desktopPosition={desktop.position} mobilePosition={mobile.position} />
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section aria-label={heading ? undefined : "Luftansa Fragrances"} aria-labelledby={heading ? "hero-heading" : undefined} className={`relative w-full bg-brand-cream ${className}`} data-hero="cms">
      <div className="relative aspect-[6/5] w-full overflow-hidden sm:aspect-[8/5] lg:aspect-auto lg:h-[clamp(528px,75vh,748px)]">
        {sameImage ? (
          // One image; the focal point still differs per breakpoint.
          <div className="absolute inset-0 [&_img]:[object-position:var(--hero-pos-m)] sm:[&_img]:[object-position:var(--hero-pos-d)]" style={{ "--hero-pos-m": mobile.position, "--hero-pos-d": desktop.position } as CSSProperties}>
            <HeroImageWithVar src={desktop.imageSrc} alt={desktop.alt} priority={priority} />
          </div>
        ) : (
          <>
            <HeroImage src={desktop.imageSrc} alt={desktop.alt} position={desktop.position} hideOn="phone" priority={priority} />
            <HeroImage src={mobile.imageSrc} alt={mobile.alt} position={mobile.position} hideOn="wider" priority={priority} />
          </>
        )}

        {desktop.videoSrc || mobile.videoSrc ? (
          <HeroVideo desktopSrc={desktop.videoSrc} mobileSrc={mobile.videoSrc} desktopPosition={desktop.position} mobilePosition={mobile.position} />
        ) : null}

        {hasText ? (
          <>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/65 via-black/20 to-transparent sm:bg-gradient-to-r sm:from-black/60 sm:via-black/25" />
            <div className="absolute inset-x-0 bottom-0 z-10 sm:inset-y-0 sm:flex sm:items-center">
              <div className="mx-auto w-full max-w-7xl px-5 pb-7 sm:px-8 sm:pb-0 lg:px-10">
                <div className="max-w-xl text-white">
                  {/* h2: the homepage has one stable h1 (src/app/page.tsx); hero slides rotate and may have no heading. */}
                  {heading ? (
                    <h2 id="hero-heading" className="font-serif text-[30px] leading-[1.06] font-semibold text-balance sm:text-[44px] lg:text-[60px]">
                      {heading}
                    </h2>
                  ) : null}
                  {subtitle ? <p className="mt-2.5 max-w-md text-[14.5px] leading-relaxed text-white/85 sm:mt-4 sm:text-[17px]">{subtitle}</p> : null}
                  {cta ? (
                    <Link
                      href={cta.href}
                      {...(internal ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                      className="group mt-5 inline-flex h-11 items-center gap-2.5 rounded-full bg-brand-ivory px-6 text-[12.5px] font-semibold tracking-[0.16em] text-brand-black uppercase ring-1 ring-brand-gold/60 transition-colors hover:bg-brand-gold hover:text-brand-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:mt-7 sm:h-12 sm:px-7"
                    >
                      {cta.label}
                      <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} />
                      {internal ? null : <span className="sr-only"> (opens in a new tab)</span>}
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function HeroImageWithVar({ src, alt, priority }: { src: string; alt: string; priority: boolean }) {
  const { props } = getImageProps({ src, alt, fill: true, sizes: "100vw", quality: 80, priority });
  // eslint-disable-next-line @next/next/no-img-element -- art-directed <picture> needs a plain <img> (props come from next/image getImageProps)
  return <img {...props} alt={alt} className="object-cover" />;
}
