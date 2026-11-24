import type { Metadata } from "next";
import { ListingCount, ListingEmpty, PillLink, ProductGrid } from "@/components/collection/ProductGrid";
import { Breadcrumbs, PageFrame, PageHeader } from "@/components/layout/PageHeader";
import { STORE_NAME } from "@/data/store";
import { loadPublished } from "@/lib/cms/loader";
import { HOME_COLLECTIONS_DEFAULT, HOME_COLLECTIONS_MODULE, MAX_COLLECTION_PRODUCTS, resolveHomeCollections, selectCollectionProducts } from "@/lib/cms/modules/home-collections";
import { getActiveStorefrontProducts, toStorefrontCardData } from "@/lib/storefront/products";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Personality Collection | ${STORE_NAME}`,
  description: "Distinctive Luftansa fragrances that reflect your unique style.",
};

/**
 * Personality Collection: the same products, heading and subtitle as the
 * homepage panel (Admin → Homepage Collections), without the homepage's card
 * limit. If the panel is switched off, the default (automatic) selection is used.
 */
export default async function PersonalityCollectionPage() {
  const [stored, products] = await Promise.all([
    loadPublished(HOME_COLLECTIONS_MODULE, [HOME_COLLECTIONS_DEFAULT]).then(resolveHomeCollections, () => HOME_COLLECTIONS_DEFAULT),
    getActiveStorefrontProducts(),
  ]);
  const settings = stored?.personality.enabled ? stored.personality : HOME_COLLECTIONS_DEFAULT.personality;
  const cards = selectCollectionProducts("personality", { ...settings, maxProducts: MAX_COLLECTION_PRODUCTS }, products).map(toStorefrontCardData);

  return (
    <PageFrame>
      <div data-collection-page="personality">
        <Breadcrumbs crumbs={[{ label: settings.heading }]} />
        <PageHeader eyebrow="Find your signature" title={settings.heading} intro={settings.subtitle}>
          <ListingCount count={cards.length} />
        </PageHeader>
        {cards.length ? (
          <ProductGrid products={cards} label={settings.heading} />
        ) : (
          <ListingEmpty text="This collection is being refreshed. Meanwhile, explore all our perfumes.">
            <div className="mt-6">
              <PillLink href="/perfumes">Shop Perfumes</PillLink>
            </div>
          </ListingEmpty>
        )}
        <div className="mt-14 flex flex-wrap justify-center gap-3 sm:mt-16">
          <PillLink href="/best-sellers">Best sellers</PillLink>
          <PillLink href="/notes">Explore by notes</PillLink>
        </div>
      </div>
    </PageFrame>
  );
}
