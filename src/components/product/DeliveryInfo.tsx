import { BadgeCheck, CreditCard, MessageCircle, RotateCcw, Truck, type LucideIcon } from "lucide-react";
import { CONTACT, POLICIES, whatsappHref } from "@/data/store";

/**
 * Delivery & service information. Policy rows render ONLY when Luftansa has
 * confirmed the text in src/data/store.ts (POLICIES); nothing is invented.
 * "Direct from Luftansa" (the brand's own store) and the confirmed WhatsApp
 * contact are always factual.
 */
export function DeliveryInfo({ productName }: { productName: string }) {
  const policies: { Icon: LucideIcon; title: string; detail?: string }[] = [
    { Icon: Truck, title: "Delivery", detail: POLICIES.delivery },
    { Icon: CreditCard, title: "Payments", detail: POLICIES.payments },
    { Icon: RotateCcw, title: "Returns", detail: POLICIES.returns },
  ];
  const rows = [
    ...policies.filter((p): p is { Icon: LucideIcon; title: string; detail: string } => Boolean(p.detail)),
    { Icon: BadgeCheck, title: "Authentic", detail: "Direct from Luftansa Fragrance Craft Hub" },
  ];

  return (
    <div className="rounded-2xl border border-brand-gold/30 bg-white/70">
      <ul className="divide-y divide-brand-gold/20">
        {rows.map(({ Icon, title, detail }) => (
          <li key={title} className="flex items-start gap-3.5 px-4 py-3.5 sm:px-5">
            <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-gold" strokeWidth={1.5} />
            <p className="text-[13.5px] leading-snug">
              <span className="font-semibold text-brand-black">{title}</span>
              <span className="block text-brand-text/70">{detail}</span>
            </p>
          </li>
        ))}
        <li className="flex items-start gap-3.5 px-4 py-3.5 sm:px-5">
          <MessageCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-gold" strokeWidth={1.5} />
          <p className="text-[13.5px] leading-snug">
            <span className="font-semibold text-brand-black">Questions about delivery or this fragrance?</span>
            <a
              href={whatsappHref(`Hello Luftansa, I have a question about ${productName}.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 block text-brand-black underline decoration-brand-gold/70 underline-offset-4 hover:decoration-brand-black"
            >
              Chat with us on WhatsApp ({CONTACT.phone})
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
        </li>
      </ul>
    </div>
  );
}
