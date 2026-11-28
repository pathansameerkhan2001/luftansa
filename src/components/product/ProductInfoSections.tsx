import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { productPageFaqs } from "@/data/faqs";
import { PRODUCT_PAGE_DEFAULT, type ProductPagePayload } from "@/lib/cms/modules/product-page";
import { FragranceNoteCircles } from "./FragranceNoteCircles";
import type { ProductDetailData } from "./types";

/**
 * Product information accordions (native <details>: no JavaScript, keyboard
 * and screen-reader friendly, works on every screen size).
 *
 * Only sections backed by real information are rendered:
 * - Description: the product's own description (hidden unless switched on in
 *   Admin → Product Page Sections; the description itself is never removed).
 * - Fragrance Notes: confirmed notes as circular ingredient images
 *   (./FragranceNoteCircles); the only place the notes appear on the page.
 * - Details: confirmed product facts only (no "to be confirmed" rows).
 * - How to Use & Care: general application/storage guidance (no product claims).
 * - FAQs: existing, confirmed store FAQs relevant to a product page (hidden
 *   unless switched on in Admin → Product Page Sections; /faqs is unchanged).
 * Ingredients / product-specific care are not part of the product data yet,
 * so those sections are not shown.
 */

/** General guidance (unchanged from the previous product page): no performance claims. */
const HOW_TO_USE = [
  "Apply to clean, moisturised skin; fragrance tends to sit better on hydrated skin.",
  "Hold the bottle a short distance away and spray lightly on pulse points such as the wrists, neck and behind the ears.",
  "Let it dry naturally rather than rubbing your wrists together.",
  "Store the bottle closed, away from direct sunlight and heat.",
];

function hasAnyNotes(product: ProductDetailData) {
  const n = product.fragranceNotes;
  return product.hasNotes !== false && Boolean(n && (n.top.length || n.heart.length || n.base.length));
}

function Section({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details open={defaultOpen} className="group border-b border-brand-gold/30">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-[14px] font-semibold tracking-[0.12em] text-brand-black uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown
          aria-hidden="true"
          className="size-5 shrink-0 text-brand-gold transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
          strokeWidth={1.6}
        />
      </summary>
      <div className="pb-5 text-[14.5px] leading-relaxed text-brand-text/85">{children}</div>
    </details>
  );
}

/**
 * `display`: optional sections (Admin → Product Page Sections). The trust tags
 * are a separate section of the product page (./TrustTags).
 */
export function ProductInfoSections({ product, display = PRODUCT_PAGE_DEFAULT }: { product: ProductDetailData; display?: ProductPagePayload }) {
  const notes = hasAnyNotes(product) ? product.fragranceNotes : undefined;
  const details: [string, string][] = [
    ["Fragrance", product.name],
    ["Type", product.category],
  ];
  if (product.options.length > 0) details.push(["Available sizes", product.options.map((o) => o.label).join(" · ")]);
  if (product.concentration) details.push(["Concentration", product.concentration]);
  if (product.gender) details.push(["Gender", product.gender]);
  if (product.keywords && product.keywords.length > 0) details.push(["Keywords", product.keywords.join(" · ")]);
  const description = display.showDescription ? product.description : undefined;
  const faqs = display.showFaq ? productPageFaqs() : [];

  return (
    <div className="border-t border-brand-gold/30">
      {description ? (
        <Section title="Description" defaultOpen>
          <p className="whitespace-pre-line text-pretty">{description}</p>
        </Section>
      ) : null}

      {notes ? (
        <Section title="Fragrance Notes" defaultOpen={!description}>
          <FragranceNoteCircles notes={notes} />
        </Section>
      ) : null}

      <Section title="Details" defaultOpen={!description && !notes}>
        <dl className="divide-y divide-brand-gold/20">
          {details.map(([term, value]) => (
            <div key={term} className="flex justify-between gap-4 py-2.5 first:pt-0">
              <dt className="text-brand-text/65">{term}</dt>
              <dd className="text-right font-medium text-brand-black">{value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="How to Use & Care">
        <ol className="space-y-2.5">
          {HOW_TO_USE.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-brand-gold/60 text-[11.5px] font-semibold text-brand-black">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </Section>

      {faqs.length > 0 ? (
        <Section title="Frequently Asked Questions">
          <dl className="space-y-4">
            {faqs.map((f) => (
              <div key={f.id}>
                <dt className="font-semibold text-brand-black">{f.question}</dt>
                <dd className="mt-1">{f.answer}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : null}
    </div>
  );
}
