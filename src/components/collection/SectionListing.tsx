import { Breadcrumbs, PageFrame, PageHeader } from "@/components/layout/PageHeader";
import { DEFAULT_ROLL_ON_SIZE_ML, SECTION_LABEL, SECTION_ROUTE } from "@/lib/catalogue/product-format";
import { sortByDisplayOrder } from "@/lib/storefront/collections";
import { getActiveStorefrontProducts, toStorefrontCardData } from "@/lib/storefront/products";
import { ListingCount, ListingEmpty, PillLink, ProductGrid } from "./ProductGrid";

type Section = "perfume" | "roll-on";

const COPY: Record<Section, { eyebrow: string; intro: string; empty: string; other: Section; otherPrompt: string }> = {
  perfume: {
    eyebrow: "Eau de parfum sprays",
    intro: "Every Luftansa fragrance in a spray bottle, in 30 ml, 50 ml and 100 ml.",
    empty: "No perfumes are available right now. Please check back soon.",
    other: "roll-on",
    otherPrompt: "Prefer something pocket-sized?",
  },
  "roll-on": {
    eyebrow: "Travel-friendly roll-ons",
    intro: `Our fragrances in a convenient ${DEFAULT_ROLL_ON_SIZE_ML} ml roll-on, for your bag, desk or travels.`,
    empty: "No roll-ons are available right now. Please check back soon.",
    other: "perfume",
    otherPrompt: "Looking for a full-size bottle?",
  },
};

/**
 * Storefront listing of one product section (Server Component): Perfumes
 * (spray products only) or Roll-On (Roll-On products only). Active products,
 * in the admin display order.
 */
export async function SectionListing({ section }: { section: Section }) {
  const copy = COPY[section];
  const products = sortByDisplayOrder((await getActiveStorefrontProducts()).filter((p) => p.format === section)).map(toStorefrontCardData);
  const title = SECTION_LABEL[section];

  return (
    <PageFrame>
      <div data-section-listing={section}>
        <Breadcrumbs crumbs={[{ label: title }]} />
        <PageHeader eyebrow={copy.eyebrow} title={title} intro={copy.intro}>
          <ListingCount count={products.length} />
        </PageHeader>

        {products.length ? (
          <ProductGrid products={products} label={title} />
        ) : (
          <ListingEmpty text={copy.empty} kind={section === "roll-on" ? "roll-on" : "spray"} />
        )}

        <div className="mt-14 flex flex-col items-center gap-3 text-center sm:mt-16">
          <p className="font-serif text-[18px] text-brand-text/80 sm:text-[20px]">{copy.otherPrompt}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <PillLink href={SECTION_ROUTE[copy.other]}>Shop {SECTION_LABEL[copy.other]}</PillLink>
            <PillLink href="/notes">Explore by notes</PillLink>
          </div>
        </div>
      </div>
    </PageFrame>
  );
}
