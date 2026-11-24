import type { Metadata } from "next";
import Link from "next/link";
import { FaqAccordion } from "@/components/faq/FaqAccordion";
import { Breadcrumbs, PageFrame, PageHeader } from "@/components/layout/PageHeader";
import { HelpCard } from "@/components/policies/PolicyArticle";
import { FAQS } from "@/data/faqs";
import { STORE_NAME } from "@/data/store";
import { livePolicyLinks } from "@/lib/storefront/policies";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `FAQs | ${STORE_NAME}`,
  description: "Answers about Luftansa fragrances, bottle sizes, fragrance notes, gifting and ordering on WhatsApp.",
};

/** Frequently Asked Questions (the same answers as the homepage section), with help and policy links. */
export default async function FaqsPage() {
  const policies = await livePolicyLinks();
  return (
    <PageFrame width="max-w-5xl">
      <Breadcrumbs crumbs={[{ label: "FAQs" }]} />
      <PageHeader eyebrow="Help & guidance" title="Frequently Asked Questions" intro="Everything you need to know about our fragrances and how to order." />

      <section aria-label="Questions and answers" className="mt-10 rounded-[24px] bg-[#2b2a28] px-5 py-6 shadow-[0_24px_48px_-30px_rgba(23,23,23,0.6)] sm:mt-12 sm:px-10 sm:py-10">
        <FaqAccordion items={FAQS} />
      </section>

      <div className="mt-10">
        <HelpCard title="Still have a question?" text="Our team will be glad to help you choose a fragrance or place an order." />
      </div>

      {policies.length ? (
        <nav aria-label="Customer policies" className="mt-8 text-center">
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {policies.map((p) => (
              <li key={p.key}>
                <Link href={p.href} className="inline-flex min-h-10 items-center text-[14px] text-brand-black underline decoration-brand-gold/60 underline-offset-4 hover:decoration-brand-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold">
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </PageFrame>
  );
}
