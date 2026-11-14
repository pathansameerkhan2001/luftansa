"use client";

import { ChevronRight } from "lucide-react";
import { useId, useState } from "react";
import type { Faq } from "@/data/faqs";

/** Accordion: one item open at a time; height animates via grid rows. */
export function FaqAccordion({ items }: { items: readonly Faq[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const baseId = useId();

  return (
    <ul className="border-t border-white/20">
      {items.map((faq) => {
        const expanded = open === faq.id;
        const buttonId = `${baseId}-q-${faq.id}`;
        const panelId = `${baseId}-a-${faq.id}`;
        return (
          <li key={faq.id} className="border-b border-white/20" data-faq={faq.id}>
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => setOpen(expanded ? null : faq.id)}
                className="flex w-full items-center justify-between gap-4 py-4 text-left text-[15px] leading-snug text-white transition-colors hover:text-brand-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold sm:py-5 sm:text-[16.5px]"
              >
                {faq.question}
                <ChevronRight
                  aria-hidden="true"
                  className={`size-5 shrink-0 transition-transform duration-300 motion-reduce:transition-none ${expanded ? "rotate-90 text-brand-gold" : ""}`}
                  strokeWidth={1.75}
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
                expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
              inert={!expanded}
            >
              <div className="overflow-hidden">
                <p className="max-w-3xl pr-8 pb-5 text-[14px] leading-relaxed text-white/70 sm:text-[14.5px]">{faq.answer}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
