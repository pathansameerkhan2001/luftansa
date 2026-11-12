import { Clock, Gem, Gift, type LucideIcon } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

/** Line-art perfume bottle drawn to match Lucide's 24px / stroke style. */
function PerfumeBottleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="9" y="2" width="6" height="3.5" rx="0.75" />
      <path d="M10.5 5.5v2.5M13.5 5.5v2.5" />
      <rect x="5" y="8" width="14" height="14" rx="3" />
      <path d="M8.5 13.5h7" />
    </svg>
  );
}

type IconComponent = LucideIcon | ComponentType<SVGProps<SVGSVGElement>>;

export interface Benefit {
  title: string;
  description: string;
  Icon: IconComponent;
}

export const DEFAULT_BENEFITS: readonly Benefit[] = [
  { Icon: PerfumeBottleIcon, title: "41 Signature Scents", description: "A diverse range of fine fragrances" },
  { Icon: Clock, title: "Long Lasting", description: "All-day performance" },
  { Icon: Gem, title: "Premium Quality", description: "Expertly crafted blends" },
  { Icon: Gift, title: "Perfect for Gifting", description: "Elegant and luxury packaging" },
];

export function BenefitsStrip({ items = DEFAULT_BENEFITS }: { items?: readonly Benefit[] }) {
  return (
    <section aria-labelledby="benefits-heading" className="bg-brand-ivory">
      <h2 id="benefits-heading" className="sr-only">
        Why choose Luftansa
      </h2>
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:py-12">
        <ul className="grid grid-cols-2 gap-y-8 lg:grid-cols-4 lg:gap-y-0">
          {items.map(({ Icon, title, description }, i) => (
            <li
              key={title}
              className={[
                "flex flex-col items-center gap-3 px-2 text-center sm:flex-row sm:items-center sm:gap-4 sm:px-6 sm:text-left lg:justify-center lg:px-4 xl:px-6",
                // Hairline separators: between columns on every row, never on the outer edge.
                i % 2 === 1 ? "border-l border-brand-black/15" : "",
                i === 2 ? "lg:border-l lg:border-brand-black/15" : "",
              ].join(" ")}
            >
              <Icon aria-hidden="true" className="size-8 shrink-0 text-brand-black sm:size-9" strokeWidth={1.25} />
              <div className="min-w-0">
                <h3 className="font-serif lining-nums text-[17px] leading-tight font-semibold text-brand-black sm:text-[19px]">
                  {title}
                </h3>
                <p className="mt-1 text-[12.5px] leading-snug text-brand-text/75 sm:text-[13px]">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
