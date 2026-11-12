import Image from "next/image";
import Link from "next/link";
import { BRAND_ASSETS, getAssetUrl } from "@/lib/assets";

const logo = BRAND_ASSETS.logo;

/**
 * The original Luftansa logo, unmodified, at its native 1183×1600 aspect ratio.
 * Height is fixed per breakpoint and width follows the intrinsic ratio, so space
 * is reserved before the image loads (no layout shift) and nothing is cropped.
 *
 * `mix-blend-multiply` is display-only: the logo's white JPEG background renders
 * as the ivory header colour, while the black artwork is unchanged.
 */
export function BrandLogo() {
  return (
    <div className="bg-brand-ivory">
      <div className="mx-auto flex max-w-7xl justify-center px-4 py-1 sm:py-2">
        <Link
          href="/"
          aria-label={`${logo.alt} — home`}
          className="block focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-brand-gold"
        >
          <Image
            src={getAssetUrl(logo.key)}
            alt={logo.alt}
            width={logo.width}
            height={logo.height}
            priority
            sizes="(min-width: 1024px) 131px, (min-width: 640px) 110px, 89px"
            className="h-[120px] w-auto mix-blend-multiply sm:h-[148px] lg:h-[176px]"
          />
        </Link>
      </div>
    </div>
  );
}
