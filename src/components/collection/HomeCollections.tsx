import { getAssetUrl } from "@/lib/assets";
import { productHref } from "@/lib/routes";
import { sprayOptions, type Product } from "@/data/products";
import { bySection, SECTION_ROUTE } from "@/lib/catalogue/product-format";
import { selectPersonality, sortByDisplayOrder } from "@/lib/storefront/collections";
import { getActiveStorefrontProducts, toStorefrontCardData } from "@/lib/storefront/products";
import { CollectionPanel } from "./CollectionPanel";
import type { ProductCardData } from "./ProductCard";

/** Spray perfumes: confirmed sizes priced from the standard price list (+ configured MRP/offers). */
export function toSprayCardData(product: Product): ProductCardData {
  const { slug, name, description, image } = product;
  return {
    slug,
    name,
    description,
    href: productHref(slug),
    options: sprayOptions(product),
    image: image ? { src: getAssetUrl(image.key), alt: image.alt, objectPosition: image.objectPosition } : undefined,
  };
}

/**
 * Homepage collections: Personality (Perfumes only) and Roll On (Roll-On
 * products only), side by side from xl. The Roll On panel is left out while
 * no Roll-On product is active, so the Perfumes panel then spans the row.
 */
export async function HomeCollections() {
  const sections = bySection(await getActiveStorefrontProducts());

  // "personality" members first, then every other active Perfume (existing homepage behaviour).
  const personality = selectPersonality(sections.perfume).map(toStorefrontCardData);
  const rollOns = sortByDisplayOrder(sections["roll-on"]).map(toStorefrontCardData);

  return (
    <div className="bg-brand-cream">
      <div className={`mx-auto grid max-w-[1600px] grid-cols-1 gap-10 px-4 pt-12 pb-14 sm:px-8 sm:pt-16 sm:pb-20 xl:gap-8 2xl:gap-10 ${rollOns.length ? "xl:grid-cols-2" : ""}`}>
        <CollectionPanel
          id="personality-collection"
          title="Personality Collection"
          subtitle="Distinctive fragrances that reflect your unique style."
          products={personality}
          viewAll={{ href: SECTION_ROUTE.perfume, label: "View all perfumes" }}
        />
        {rollOns.length ? (
          <CollectionPanel
            id="roll-on-collection"
            title="Roll On Collection"
            subtitle="Discover your favourite fragrances in a convenient roll-on format."
            products={rollOns}
            placeholder="roll-on"
            viewAll={{ href: SECTION_ROUTE["roll-on"], label: "View all roll-ons" }}
          />
        ) : null}
      </div>
    </div>
  );
}
