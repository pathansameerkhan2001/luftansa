import { FlaskConical, Rabbit, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import type { SVGProps } from "react";
import type { TrustTagId, TrustTagView } from "@/lib/cms/modules/trust-tags";

/** Ashoka Chakra (24-spoke wheel of the Indian flag) as a thin line icon, Lucide-style. */
function ChakraIcon(props: SVGProps<SVGSVGElement>) {
  const spokes = Array.from({ length: 24 }, (_, i) => (i * Math.PI) / 12);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="12" r="1.6" />
      {spokes.map((a) => (
        <line key={a} x1={(12 + 1.6 * Math.cos(a)).toFixed(2)} y1={(12 + 1.6 * Math.sin(a)).toFixed(2)} x2={(12 + 9.5 * Math.cos(a)).toFixed(2)} y2={(12 + 9.5 * Math.sin(a)).toFixed(2)} strokeWidth={0.55} />
      ))}
    </svg>
  );
}

const ICON: Record<TrustTagId, LucideIcon | typeof ChakraIcon> = {
  "lab-tested": FlaskConical,
  "people-surveyed": Users,
  "made-in-india": ChakraIcon,
  vegan: Rabbit,
  ifra: ShieldCheck,
};

/**
 * Global quality tags (Admin → Product Trust Tags): thin line icons above
 * short labels. A list only: the product page places it in its own section
 * (TrustTagsSection). Two per row on phones, three on tablets and all five in
 * one row on desktop; a final odd tag is centred. Same on every product page.
 */
export function TrustTags({ tags }: { tags: readonly TrustTagView[] }) {
  if (tags.length === 0) return null;
  return (
    <ul aria-label="Quality promises" className="flex flex-wrap justify-center gap-y-7 sm:gap-y-8" data-trust-tags>
      {tags.map(({ id, label }) => {
        const Icon = ICON[id];
        return (
          <li key={id} className="flex w-1/2 min-w-0 flex-col items-center px-2 text-center sm:w-1/3 lg:w-auto lg:flex-1" data-trust-tag={id}>
            <Icon aria-hidden="true" className="size-8 text-brand-black" strokeWidth={1.1} />
            <span className="mt-2.5 max-w-[16ch] text-[14px] lg:max-w-[20ch] leading-snug text-pretty text-brand-black sm:text-[14.5px]">{label}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Standalone product-page section for the trust tags: full width between the
 * product and the fragrance notes, not nested in any accordion or column.
 */
export function TrustTagsSection({ tags }: { tags: readonly TrustTagView[] }) {
  if (tags.length === 0) return null;
  return (
    <section aria-labelledby="quality-promises-heading" className="border-y border-brand-gold/20 bg-brand-ivory" data-trust-section>
      <div className="mx-auto max-w-[1100px] px-4 py-10 sm:px-8 sm:py-12">
        <h2 id="quality-promises-heading" className="sr-only">
          Our quality promises
        </h2>
        <TrustTags tags={tags} />
      </div>
    </section>
  );
}
