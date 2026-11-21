import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { BadgePosition, CollectionPanelView, ImageRatio } from "@/lib/cms/modules/home-collections";
import { CollectionProductCard } from "./CollectionProductCard";
import { ProductCarousel } from "./ProductCarousel";

const BACKGROUND: Record<CollectionPanelView["background"], string> = {
  ivory: "bg-[linear-gradient(180deg,#fffaf1_0%,var(--brand-ivory)_100%)]",
  cream: "bg-[linear-gradient(180deg,#fbf6ea_0%,var(--brand-cream)_100%)]",
  white: "bg-white",
};

/** Cards rise in turn when the panel is revealed (the panel's Reveal sets data-reveal). */
const cardRise =
  "transition-[opacity,translate] duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[reveal=hidden]/reveal:translate-y-5 group-data-[reveal=hidden]/reveal:opacity-0 motion-reduce:transition-none";

function ViewAllLink({ href, label, panel }: { href: string; label: string; panel: string }) {
  const className =
    "group/va inline-flex min-h-11 items-center gap-2 border-b border-brand-gold pt-1 pb-0.5 text-[17px] font-semibold text-brand-black transition-colors hover:text-[#6b5328] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold sm:text-[19px]";
  const body = (
    <>
      {label}
      <ArrowRight aria-hidden="true" className="size-4.5 transition-transform group-hover/va:translate-x-0.5 motion-reduce:transition-none" strokeWidth={2} />
    </>
  );
  return href.startsWith("/") ? (
    <Link href={href} className={className} data-view-all={panel}>
      {body}
    </Link>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} data-view-all={panel}>
      {body}
    </a>
  );
}

/**
 * Rounded, fine gold-bordered collection panel (reference design): the
 * Luftansa wordmark between thin gold lines, the uppercase serif heading, an
 * italic subtitle, a View All link and the panel's own product carousel.
 */
export function CollectionPanel({ panel, decorative, imageRatio, badgePosition }: { panel: CollectionPanelView; decorative: boolean; imageRatio: ImageRatio; badgePosition: BadgePosition }) {
  const headingId = `${panel.anchor}-heading`;
  const line = decorative ? <span aria-hidden="true" className="h-px w-10 shrink-0 bg-brand-gold min-[400px]:w-14 sm:w-24 xl:w-20 2xl:w-28" /> : null;

  return (
    <section
      id={panel.anchor}
      aria-labelledby={headingId}
      className={`relative flex h-full flex-col rounded-[24px] border border-brand-gold/45 px-4 pt-6 pb-4 shadow-[0_18px_40px_-28px_rgba(120,92,40,0.4)] min-[400px]:px-5 sm:rounded-[30px] sm:px-8 sm:pt-8 sm:pb-6 xl:px-7 2xl:px-9 ${BACKGROUND[panel.background]}`}
      data-collection-panel={panel.key}
    >
      <header className="text-center">
        {panel.showWordmark ? (
          <div className="flex items-center justify-center gap-3 sm:gap-5" data-wordmark>
            {line}
            <span aria-hidden="true" className="font-serif text-[36px] leading-none font-semibold text-brand-black italic [-webkit-text-stroke:0.9px_currentColor] sm:text-[46px] sm:[-webkit-text-stroke:1.1px_currentColor] 2xl:text-[50px]">
              Luftansa
            </span>
            {line}
          </div>
        ) : null}
        <h2
          id={headingId}
          className={`font-serif text-[23px] leading-[1.1] font-semibold tracking-[0.06em] text-balance text-brand-black uppercase min-[400px]:text-[25px] sm:text-[34px] xl:text-[31px] 2xl:text-[38px] ${panel.showWordmark ? "mt-2.5 sm:mt-3" : ""}`}
        >
          {panel.showWordmark ? <span className="sr-only">Luftansa </span> : null}
          {panel.heading}
        </h2>
        {panel.subtitle ? (
          <p className="mx-auto mt-2 max-w-xl font-serif text-[16.5px] leading-snug font-medium text-pretty text-brand-black/90 italic sm:mt-2.5 sm:text-[20px] 2xl:text-[21px]">{panel.subtitle}</p>
        ) : null}
        {panel.viewAll ? (
          <div className="mt-1.5 flex justify-center sm:mt-2">
            <ViewAllLink href={panel.viewAll.href} label={panel.viewAll.label} panel={panel.anchor} />
          </div>
        ) : null}
      </header>

      <div className="mt-5 flex flex-1 flex-col sm:mt-6">
        <ProductCarousel label={`${panel.heading} products`}>
          {panel.cards.map((card, i) => (
            <div key={card.slug} className={`h-full ${cardRise}`} style={{ transitionDelay: `${Math.min(i, 3) * 110 + 150}ms` }}>
              <CollectionProductCard card={card} imageRatio={imageRatio} badgePosition={badgePosition} />
            </div>
          ))}
        </ProductCarousel>
      </div>
    </section>
  );
}
