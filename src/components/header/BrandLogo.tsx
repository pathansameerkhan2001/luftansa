import Image from "next/image";
import Link from "next/link";
import { BRAND_ASSETS, getAssetUrl } from "@/lib/assets";
import { SearchForm } from "./SearchForm";

const logo = BRAND_ASSETS.logo;

/**
 * Non-destructive display window onto the original logo (1183×1600).
 *
 * Measured ink bands in the source image (px):
 *   hummingbird + flowers  y 242–951,  x 235–1018
 *   "Luftansa" wordmark    y 1110–1262, x 306–946
 *   "FRAGRANCE CRAFT HUB"  y 1310–1368  ← excluded from the window
 *
 * The window keeps the artwork + full wordmark with even breathing room and is
 * centred on the artwork's own optical centre (x≈626), cutting off at y=1286 —
 * midway in the 48px gap above the tagline. The S3 file is never altered; the
 * full image is loaded and simply positioned inside an overflow-hidden frame.
 */
const WINDOW = { x: 175, y: 212, width: 903, height: 1074 } as const;

const pct = (n: number) => `${(n * 100).toFixed(4)}%`;
const imageStyle = {
  width: pct(logo.width / WINDOW.width),
  height: pct(logo.height / WINDOW.height),
  left: pct(-WINDOW.x / WINDOW.width),
  top: pct(-WINDOW.y / WINDOW.height),
  maxWidth: "none",
} as const;

export function BrandLogo() {
  return (
    <div className="bg-brand-ivory">
      {/* Equal 1fr side columns keep the logo exactly centred; search sits right. */}
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 py-1.5 sm:px-6 sm:py-2 lg:px-8 lg:py-2.5">
        <div aria-hidden="true" />
        <Link
          href="/"
          aria-label="Luftansa — home"
          className="block focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-brand-gold"
        >
          {/* Fixed-height frame with the window's aspect ratio: no layout shift. */}
          <span
            className="relative block h-[92px] overflow-hidden sm:h-[112px] lg:h-[132px]"
            style={{ aspectRatio: `${WINDOW.width} / ${WINDOW.height}` }}
          >
            <Image
              src={getAssetUrl(logo.key)}
              alt="Luftansa"
              width={logo.width}
              height={logo.height}
              priority
              sizes="(min-width: 1024px) 146px, (min-width: 640px) 124px, 102px"
              className="absolute mix-blend-multiply"
              style={imageStyle}
            />
          </span>
        </Link>
        <SearchForm
          id="header-search"
          className="hidden w-[200px] justify-self-end self-start lg:mt-2 lg:block xl:w-[220px]"
        />
      </div>
    </div>
  );
}
