import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PerfumeBottleIcon } from "@/components/benefits/BenefitsStrip";
import { ProductPhoto } from "@/components/product/ProductPhoto";
import { formatInr, hasPriceRange, startingPrice, type ProductOption } from "@/data/products";
import { RollOnBottleIcon } from "./icons";

export type { ProductOption } from "@/data/products";
export type PlaceholderKind = "spray" | "roll-on";

export interface ProductCardData {
  slug: string;
  name: string;
  description?: string;
  /** Product details page, when it exists. */
  href?: string;
  options: readonly ProductOption[];
  image?: { src: string; alt: string; objectPosition?: string };
  /** Placeholder icon for this product (a Roll-On shows a roll-on bottle). The card prop overrides it. */
  placeholder?: PlaceholderKind;
}

interface ProductCardProps {
  product: ProductCardData;
  /** Which line icon the neutral placeholder shows when no photograph exists. */
  placeholder?: PlaceholderKind;
  /** Responsive `sizes` for the photograph (defaults suit the homepage carousels). */
  imageSizes?: string;
}

/**
 * Browsing card: large photograph, name, optional description, starting price
 * and a View Details call to action. The whole card opens the product page;
 * size and quantity are chosen there. No purchase controls on the card.
 */
export function ProductCard({
  product,
  placeholder,
  imageSizes = "(min-width: 1280px) 22vw, (min-width: 640px) 45vw, 85vw",
}: ProductCardProps) {
  const { name, description, href, options, image } = product;
  const fromPrice = startingPrice(options);
  const isRange = hasPriceRange(options);
  const PlaceholderIcon = (placeholder ?? product.placeholder) === "roll-on" ? RollOnBottleIcon : PerfumeBottleIcon;

  return (
    <article
      className={`group relative flex h-full flex-col rounded-[22px] bg-white/85 p-2.5 shadow-[0_1px_2px_rgba(23,23,23,0.04),0_14px_30px_-14px_rgba(23,23,23,0.18)] ring-1 ring-brand-gold/15 transition-[box-shadow,transform] duration-300 sm:p-3 ${
        href
          ? "hover:-translate-y-0.5 hover:shadow-[0_1px_2px_rgba(23,23,23,0.05),0_22px_40px_-18px_rgba(60,45,20,0.32)] hover:ring-brand-gold/40 motion-reduce:hover:translate-y-0 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-brand-gold"
          : ""
      }`}
    >
      {/* Photograph: fixed 4:5 frame. ProductPhoto makes the bottle prominent
          without cropping or stretching it, whatever the photo's shape. */}
      <div
        data-carousel-media
        className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-[radial-gradient(120%_85%_at_50%_38%,#ffffff_0%,var(--brand-ivory)_45%,var(--brand-cream)_100%)]"
      >
        {image ? (
          <ProductPhoto
            src={image.src}
            alt={image.alt}
            sizes={imageSizes}
            preset="card"
            objectPosition={image.objectPosition}
            imageClassName="transition-[transform,opacity] duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div aria-hidden="true" className="absolute inset-0">
            <div className="absolute inset-3 rounded-xl border border-brand-gold/30" />
            <PlaceholderIcon
              className="absolute top-1/2 left-1/2 size-16 -translate-x-1/2 -translate-y-[60%] text-brand-gold/55 sm:size-20"
              strokeWidth={0.7}
            />
            <span className="absolute inset-x-0 bottom-7 text-center font-serif text-[17px] font-semibold tracking-[0.04em] text-brand-text/45 italic">
              Luftansa
            </span>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex flex-1 flex-col px-1.5 pt-4 pb-1.5 sm:px-2.5 sm:pt-5">
        <h3 className="font-serif lining-nums text-[22px] leading-tight font-semibold text-brand-black sm:text-[24px]">
          {href ? (
            // Stretched link: the whole card is clickable, with one tab stop.
            <Link href={href} className="outline-none after:absolute after:inset-0 after:rounded-[22px] after:content-['']">
              {name}
            </Link>
          ) : (
            name
          )}
        </h3>
        {description ? (
          <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-brand-text/75">{description}</p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-4">
          {fromPrice !== undefined ? (
            <p className="leading-none">
              {isRange ? (
                <span className="mb-1.5 block text-[10.5px] font-semibold tracking-[0.18em] text-brand-text/55 uppercase">
                  From
                </span>
              ) : null}
              <span className="font-sans text-[21px] font-bold tracking-[-0.01em] text-brand-black lining-nums sm:text-[22px]">
                {formatInr(fromPrice)}
              </span>
            </p>
          ) : (
            <p className="text-[13px] text-brand-text/60">Ask us about sizes &amp; prices</p>
          )}

          {href ? (
            <span
              aria-hidden="true"
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-brand-black px-4 text-[13px] font-medium tracking-[0.02em] text-brand-black transition-colors duration-200 group-hover:bg-brand-black group-hover:text-white"
            >
              View Details
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={1.75} />
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
