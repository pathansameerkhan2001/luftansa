import { FAQS } from "@/data/faqs";
import { FaqAccordion } from "./FaqAccordion";

/** Dark charcoal "Frequently Asked Questions" section (anchor: #faqs). */
export function FaqSection() {
  return (
    <section id="faqs" aria-labelledby="faq-heading" className="scroll-mt-6 bg-[#2b2a28]">
      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-8 sm:py-20">
        <p className="flex items-center justify-center gap-4 text-[11px] font-semibold tracking-[0.34em] text-brand-gold uppercase sm:text-[12px]">
          <span aria-hidden="true" className="h-px w-10 bg-brand-gold/60 sm:w-14" />
          Help &amp; Guidance
          <span aria-hidden="true" className="h-px w-10 bg-brand-gold/60 sm:w-14" />
        </p>
        <h2
          id="faq-heading"
          className="mt-3 text-center font-serif text-[32px] leading-tight font-semibold text-white sm:text-[40px] lg:text-[44px]"
        >
          Frequently Asked Questions
        </h2>
        <div className="mt-8 sm:mt-10">
          <FaqAccordion items={FAQS} />
        </div>
      </div>
    </section>
  );
}
