import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingCount, PillLink, ProductGrid } from "@/components/collection/ProductGrid";
import { Breadcrumbs, PageFrame, PageHeader } from "@/components/layout/PageHeader";
import { STORE_NAME } from "@/data/store";
import { selectAttar } from "@/lib/storefront/collection-pages";
import { getActiveStorefrontProducts, toStorefrontCardData } from "@/lib/storefront/products";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Attar | ${STORE_NAME}`,
  description: "Luftansa attars: concentrated perfume oils.",
};

/**
 * Attar: active products of the Attar type (Admin → Products). The page and its
 * footer link only exist while at least one Attar is active, so visitors never
 * reach an empty page.
 */
export default async function AttarPage() {
  const products = selectAttar(await getActiveStorefrontProducts()).map(toStorefrontCardData);
  if (products.length === 0) notFound();
  return (
    <PageFrame>
      <div data-collection-page="attar">
        <Breadcrumbs crumbs={[{ label: "Attar" }]} />
        <PageHeader eyebrow="Perfume oils" title="Attar">
          <ListingCount count={products.length} />
        </PageHeader>
        <ProductGrid products={products} label="Attar" />
        <div className="mt-14 flex flex-wrap justify-center gap-3 sm:mt-16">
          <PillLink href="/perfumes">Shop Perfumes</PillLink>
          <PillLink href="/roll-on">Shop Roll-On</PillLink>
        </div>
      </div>
    </PageFrame>
  );
}
