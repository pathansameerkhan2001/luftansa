import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CollectionListing } from "@/components/collection/CollectionListing";
import { STORE_NAME } from "@/data/store";
import { loadPublished } from "@/lib/cms/loader";
import { findActiveCollection, NAV_COLLECTIONS_DEFAULT, NAV_COLLECTIONS_MODULE, resolveNavCollections, selectNavCollectionProducts } from "@/lib/cms/modules/nav-collections";
import { getActiveStorefrontProducts, toStorefrontCardData } from "@/lib/storefront/products";

// Refreshed on publish (cms:nav-collections) and after product writes (revalidateStorefront); hourly safety net.
export const revalidate = 3600;
export const dynamicParams = true;

const loadSettings = () => loadPublished(NAV_COLLECTIONS_MODULE, [NAV_COLLECTIONS_DEFAULT]).then(resolveNavCollections, () => NAV_COLLECTIONS_DEFAULT);

export async function generateStaticParams() {
  const settings = await loadSettings();
  return (settings?.collections ?? []).filter((c) => c.enabled && !c.linkTo).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const collection = findActiveCollection(await loadSettings(), slug);
  if (!collection) return { title: `Collection not found | ${STORE_NAME}`, robots: { index: false } };
  return { title: `${collection.name} | ${STORE_NAME}`, description: collection.description ?? `${collection.name} by ${STORE_NAME}.` };
}

/**
 * A collection from the header's COLLECTIONS menu (Admin → Collections Menu).
 * Inactive or unknown collections 404. A collection that opens an existing
 * page (e.g. Roll-On Air Freshener → /roll-on) redirects there, so the same
 * products never live at two addresses. An active collection without products
 * yet shows an empty state with ways onward, never an error.
 */
export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const collection = findActiveCollection(await loadSettings(), slug);
  if (!collection) notFound();
  if (collection.linkTo) redirect(collection.linkTo);
  const products = selectNavCollectionProducts(collection, await getActiveStorefrontProducts()).map(toStorefrontCardData);
  return <CollectionListing collection={collection} products={products} />;
}
