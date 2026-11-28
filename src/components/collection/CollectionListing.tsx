import Image from "next/image";
import { Breadcrumbs, PageFrame, PageHeader } from "@/components/layout/PageHeader";
import { getAssetUrl } from "@/lib/assets";
import type { NavCollection } from "@/lib/cms/modules/nav-collections";
import { ListingCount, ListingEmpty, PillLink, ProductGrid } from "./ProductGrid";
import type { ProductCardData } from "./ProductCard";

/**
 * Storefront listing of one header collection (Admin → Collections Menu), in
 * the same look as the Perfumes and Roll-On listings: optional collection
 * image, the products, or an elegant empty state with ways onward.
 */
export function CollectionListing({ collection, products }: { collection: Pick<NavCollection, "slug" | "name" | "description" | "imageKey" | "imageAlt">; products: readonly ProductCardData[] }) {
  const image = collection.imageKey ? { src: getAssetUrl(collection.imageKey), alt: collection.imageAlt ?? "" } : undefined;
  return (
    <PageFrame>
      <div data-collection-page={collection.slug}>
        <Breadcrumbs crumbs={[{ label: collection.name }]} />
        <PageHeader eyebrow="Collection" title={collection.name} intro={collection.description}>
          <ListingCount count={products.length} noun="product" />
        </PageHeader>

        {image ? (
          <div className="relative mx-auto mt-8 aspect-[21/9] w-full max-w-5xl overflow-hidden rounded-[22px] bg-brand-ivory ring-1 ring-brand-gold/20 sm:mt-10">
            <Image src={image.src} alt={image.alt} fill sizes="(min-width: 1100px) 1024px, 94vw" className="object-cover" priority />
          </div>
        ) : null}

        {products.length ? (
          <ProductGrid products={products} label={collection.name} />
        ) : (
          <ListingEmpty text={`Our ${collection.name} range is coming soon. Please check back shortly.`} />
        )}

        <div className="mt-14 flex flex-wrap justify-center gap-3 sm:mt-16">
          <PillLink href="/perfumes">Shop Perfumes</PillLink>
          <PillLink href="/notes">Explore by notes</PillLink>
        </div>
      </div>
    </PageFrame>
  );
}
