import type { Metadata } from "next";
import { ListingCount, ListingEmpty, PillLink, ProductGrid } from "@/components/collection/ProductGrid";
import { Breadcrumbs, PageFrame, PageHeader } from "@/components/layout/PageHeader";
import { STORE_NAME } from "@/data/store";
import { selectBestSellers } from "@/lib/storefront/collections";
import { getActiveStorefrontProducts, toStorefrontCardData } from "@/lib/storefront/products";

// Refreshed on demand after admin writes (revalidateStorefront); hourly safety net.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Best Sellers | ${STORE_NAME}`,
  description: "The Luftansa fragrances our customers love most.",
};

/** Best Sellers: products marked Best Seller in Admin → Products, in display order. */
export default async function BestSellersPage() {
  const products = selectBestSellers(await getActiveStorefrontProducts()).map(toStorefrontCardData);
  return (
    <PageFrame>
      <div data-collection-page="best-sellers">
        <Breadcrumbs crumbs={[{ label: "Best Sellers" }]} />
        <PageHeader eyebrow="Most loved" title="Best Sellers" intro="The Luftansa fragrances our customers return to again and again.">
          <ListingCount count={products.length} />
        </PageHeader>
        {products.length ? (
          <ProductGrid products={products} label="Best Sellers" />
        ) : (
          <ListingEmpty text="Our best sellers will appear here. Meanwhile, explore the full collection.">
            <div className="mt-6">
              <PillLink href="/perfumes">Shop Perfumes</PillLink>
            </div>
          </ListingEmpty>
        )}
        <div className="mt-14 flex flex-wrap justify-center gap-3 sm:mt-16">
          <PillLink href="/perfumes">Shop all perfumes</PillLink>
          <PillLink href="/notes">Explore by notes</PillLink>
        </div>
      </div>
    </PageFrame>
  );
}
