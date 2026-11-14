import { BadgeCheck, CreditCard, RotateCcw, Truck, type LucideIcon } from "lucide-react";
import { POLICIES } from "@/data/store";

/**
 * Service badges. Titles stay neutral and the detail line shows the confirmed
 * policy text, or "coming soon" while a policy is not yet configured
 * (src/data/store.ts). "Direct from Luftansa" is factual for the brand's own store.
 */
export function TrustBadges() {
  const items: { Icon: LucideIcon; title: string; detail: string }[] = [
    { Icon: Truck, title: "Delivery", detail: POLICIES.delivery ?? "Policy coming soon" },
    { Icon: CreditCard, title: "Payments", detail: POLICIES.payments ?? "Details coming soon" },
    { Icon: RotateCcw, title: "Returns", detail: POLICIES.returns ?? "Policy coming soon" },
    { Icon: BadgeCheck, title: "Authentic", detail: "Direct from Luftansa" },
  ];

  return (
    <ul className="grid grid-cols-2 gap-y-5 rounded-2xl border border-brand-gold/25 bg-white/60 px-2 py-4 sm:grid-cols-4 sm:divide-x sm:divide-brand-gold/25">
      {items.map(({ Icon, title, detail }) => (
        <li key={title} className="flex flex-col items-center px-2 text-center">
          <Icon aria-hidden="true" className="size-6 text-brand-black" strokeWidth={1.4} />
          <span className="mt-2 text-[13px] font-semibold text-brand-black">{title}</span>
          <span className="mt-0.5 text-[11.5px] leading-snug text-brand-text/65">{detail}</span>
        </li>
      ))}
    </ul>
  );
}
