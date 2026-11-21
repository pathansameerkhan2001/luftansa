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
 * short labels, three per row on wider screens and two on phones, with a
 * final odd tag centred. Same on every product page.
 */
export function TrustTags({ tags }: { tags: readonly TrustTagView[] }) {
  if (tags.length === 0) return null;
  return (
    <ul aria-label="Quality promises" className="mt-5 flex flex-wrap justify-center gap-y-6 border-t border-brand-gold/20 pt-6" data-trust-tags>
      {tags.map(({ id, label }) => {
        const Icon = ICON[id];
        return (
          <li key={id} className="flex w-1/2 flex-col items-center px-2 text-center sm:w-1/3" data-trust-tag={id}>
            <Icon aria-hidden="true" className="size-8 text-brand-black" strokeWidth={1.1} />
            <span className="mt-2.5 text-[14px] leading-snug text-pretty text-brand-black sm:text-[14.5px]">{label}</span>
          </li>
        );
      })}
    </ul>
  );
}
