import Image from "next/image";
import type { CSSProperties } from "react";
import { getAssetUrl } from "@/lib/assets";
import { HERO_BANNER, type HeroBannerConfig } from "./hero-banner";

interface HeroSectionProps {
  banner?: HeroBannerConfig;
}

/**
 * Image-only, full-width hero banner (Server Component). No text, controls or
 * overlays. S3 keys resolve on the server (CloudFront or the private /media route).
 *
 * The previous text carousel (HeroCarousel + hero-slides) is kept in this folder
 * unchanged and can be re-enabled by rendering <HeroCarousel /> again.
 */
export function HeroSection({ banner = HERO_BANNER }: HeroSectionProps) {
  const src = banner.key ? getAssetUrl(banner.key) : banner.src;
  if (!src) return null;

  const position = banner.objectPosition ?? { base: "50% 50%" };

  return (
    <section aria-label="Luftansa Fragrances" className="relative w-full bg-brand-cream">
      <div className="relative aspect-[4/3] w-full overflow-hidden sm:aspect-[16/9] lg:aspect-auto lg:h-[clamp(480px,68vh,680px)]">
        <Image
          src={src}
          alt={banner.alt}
          fill
          priority
          sizes="100vw"
          quality={80}
          className="object-cover [object-position:var(--hero-pos)] lg:[object-position:var(--hero-pos-lg)]"
          style={
            {
              "--hero-pos": position.base,
              "--hero-pos-lg": position.lg ?? position.base,
            } as CSSProperties
          }
        />
      </div>
    </section>
  );
}
