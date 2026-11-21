import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Gift, Star, Zap } from "lucide-react";
import { PerfumeBottleIcon } from "@/components/benefits/BenefitsStrip";
import { formatInr } from "@/data/products";
import type { Badge, BadgePosition, CollectionCardView, ImageRatio } from "@/lib/cms/modules/home-collections";
import { BADGE_LABEL } from "@/lib/cms/modules/home-collections";
import { RollOnBottleIcon } from "./icons";

const RATIO: Record<ImageRatio, string> = { "4:5": "aspect-[4/5]", "3:4": "aspect-[3/4]", "2:3": "aspect-[2/3]" };

const BADGE_STYLE: Record<Badge, { className: string; Icon: typeof Star }> = {
  "best-seller": { className: "bg-[#7a1d1d] text-white [&>svg]:fill-[#e6c27a] [&>svg]:text-[#e6c27a]", Icon: Star },
  "new-launch": { className: "bg-[#7a1d1d] text-white [&>svg]:fill-[#e6c27a] [&>svg]:text-[#e6c27a]", Icon: Zap },
  "buy-one-get-one": { className: "bg-[#f6e2b3] text-[#2a2118] [&>svg]:text-[#7a1d1d]", Icon: Gift },
};

/**
 * Homepage collection card (reference design): a large portrait photograph
 * filling its frame with the product's badges over it, then name and size,
 * notes, price with the original price and saving, attribute pills and a black
 * View Details button. Every value comes from the product record. The View
 * Details link covers the whole card (one tab stop per card).
 */
export function CollectionProductCard({ card, imageRatio, badgePosition }: { card: CollectionCardView; imageRatio: ImageRatio; badgePosition: BadgePosition }) {
  const { title, href, image, badges, notes, price, attributes } = card;
  const Placeholder = card.placeholder === "roll-on" ? RollOnBottleIcon : PerfumeBottleIcon;

  return (
    <article className="group/card relative flex h-full flex-col" data-collection-card={card.slug}>
      <div
        data-carousel-media
        className={`relative ${RATIO[imageRatio]} overflow-hidden rounded-[20px] bg-[radial-gradient(120%_85%_at_50%_38%,#ffffff_0%,var(--brand-ivory)_45%,#efe4cf_100%)] shadow-[0_14px_30px_-18px_rgba(60,40,15,0.45)] sm:rounded-[22px]`}
      >
        {image ? (
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(min-width: 1280px) 22vw, (min-width: 640px) 45vw, 82vw"
            className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/card:scale-[1.045] motion-reduce:transition-none motion-reduce:group-hover/card:scale-100"
            style={{ objectPosition: image.objectPosition ?? "50% 50%" }}
            data-card-image
          />
        ) : (
          <div aria-hidden="true" className="absolute inset-0" data-card-placeholder>
            <Placeholder className="absolute top-1/2 left-1/2 size-16 -translate-x-1/2 -translate-y-[60%] text-brand-gold/60 sm:size-20" strokeWidth={0.7} />
            <span className="absolute inset-x-0 bottom-6 text-center text-[10.5px] font-medium tracking-[0.22em] text-brand-text/45 uppercase">Photograph coming soon</span>
          </div>
        )}

        {badges.length ? (
          <ul
            className={`absolute top-2.5 flex max-w-[calc(100%-1.25rem)] flex-col gap-1.5 sm:top-3.5 ${badgePosition === "top-right" ? "right-2.5 items-end sm:right-3.5" : "left-2.5 items-start sm:left-3.5"}`}
            aria-label="Offers"
            data-card-badges
          >
            {badges.map((b) => {
              const { className, Icon } = BADGE_STYLE[b];
              return (
                <li
                  key={b}
                  className={`inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-[10.5px] leading-none font-bold tracking-[0.04em] uppercase shadow-[0_4px_10px_-4px_rgba(0,0,0,0.45)] min-[400px]:text-[11.5px] sm:px-2.5 sm:py-1.5 sm:text-[12.5px] ${className}`}
                  data-badge={b}
                >
                  <Icon aria-hidden="true" className="size-3 shrink-0 sm:size-3.5" strokeWidth={2.25} />
                  <span className="truncate">{BADGE_LABEL[b]}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-1 pt-3.5 sm:px-1.5 sm:pt-4">
        <h3 className="font-serif text-[20px] leading-tight font-semibold text-balance text-brand-black lining-nums [-webkit-text-stroke:0.35px_currentColor] sm:text-[22px] 2xl:text-[24px]" data-card-title>
          {title}
        </h3>
        {notes.length ? (
          <p className="mt-1 font-serif text-[15.5px] leading-snug font-medium text-brand-text/75 sm:text-[17px]" data-card-notes>
            {notes.join(" • ")}
          </p>
        ) : null}

        {price ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5" data-card-price>
            <span className="text-[21px] font-bold tracking-[-0.01em] text-brand-black lining-nums sm:text-[23px]">{formatInr(price.selling)}</span>
            {price.original ? (
              <s className="text-[14px] text-brand-text/50 lining-nums sm:text-[15px]" data-card-original>
                <span className="sr-only">Original price </span>
                {formatInr(price.original)}
              </s>
            ) : null}
            {price.discountPercent ? (
              <span className="ml-auto rounded-md bg-[#f6e2b3] px-2 py-1 text-[12px] leading-none font-bold text-[#2a2118] sm:text-[13px]" data-card-discount>
                {price.discountPercent}% OFF
              </span>
            ) : null}
          </div>
        ) : (
          <p className="mt-2.5 text-[13px] text-brand-text/60">Sizes &amp; pricing coming soon</p>
        )}

        {attributes.length ? (
          <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Details" data-card-attributes>
            {attributes.map((a) => (
              <li key={a} className="rounded-md bg-[#f3ead8] px-2.5 py-1 text-[12px] leading-tight font-medium text-brand-text/85 sm:text-[12.5px]">
                {a}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-auto pt-4">
          <Link
            href={href}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-black px-4 text-[15px] font-semibold text-white transition-colors duration-300 after:absolute after:inset-0 after:content-[''] hover:bg-[#3a3631] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold group-hover/card:bg-[#3a3631] motion-reduce:transition-none sm:min-h-12 sm:text-[16px]"
            data-card-link
          >
            View Details<span className="sr-only">: {title}</span>
            <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-300 group-hover/card:translate-x-0.5 motion-reduce:transition-none" strokeWidth={2.25} />
          </Link>
        </div>
      </div>
    </article>
  );
}
