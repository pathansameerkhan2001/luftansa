import { getAssetUrl } from "@/lib/assets";
import { productHref } from "@/lib/routes";
import {
  getProductsBySlugs,
  PERSONALITY_COLLECTION_SLUGS,
  ROLL_ON_PRODUCTS,
  rollOnOptions,
  sprayOptions,
  type Product,
  type RollOnProduct,
} from "@/data/products";
import { CollectionPanel } from "./CollectionPanel";
import { RollOnBottleIcon } from "./icons";
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

/** Roll-ons: each variant carries its own confirmed price (never the spray price list). */
function toRollOnCardData(product: RollOnProduct): ProductCardData {
  const { slug, name, image } = product;
  return {
    slug,
    name,
    options: rollOnOptions(product),
    image: image ? { src: getAssetUrl(image.key), alt: image.alt, objectPosition: image.objectPosition } : undefined,
  };
}

function RollOnComingSoon() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-[22px] bg-[radial-gradient(110%_80%_at_50%_30%,var(--brand-ivory)_0%,var(--brand-cream)_75%)] px-6 py-14 text-center ring-1 ring-brand-gold/20">
      <div aria-hidden="true" className="pointer-events-none absolute inset-3 rounded-2xl border border-brand-gold/25" />
      <RollOnBottleIcon aria-hidden="true" className="size-16 text-brand-gold/60" strokeWidth={0.75} />
      <p className="mt-5 text-[11px] font-medium tracking-[0.32em] text-brand-black uppercase sm:text-[12px]">
        Coming soon
      </p>
      <p className="mt-2 max-w-xs font-serif text-[17px] leading-snug text-brand-text/80">
        Our roll-on fragrances will be available here shortly.
      </p>
    </div>
  );
}

/** Homepage collections: Personality and Roll On panels (side by side from xl). */
export function HomeCollections() {
  const personality = getProductsBySlugs(PERSONALITY_COLLECTION_SLUGS).map(toSprayCardData);
  const rollOns = ROLL_ON_PRODUCTS.map(toRollOnCardData);

  return (
    <div className="bg-brand-cream">
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-10 px-4 pt-12 pb-14 sm:px-8 sm:pt-16 sm:pb-20 xl:grid-cols-2 xl:gap-8 2xl:gap-10">
        <CollectionPanel
          id="personality-collection"
          title="Personality Collection"
          subtitle="Distinctive fragrances that reflect your unique style."
          products={personality}
        />
        <CollectionPanel
          id="roll-on-collection"
          title="Roll On Collection"
          subtitle="Discover your favourite fragrances in a convenient roll-on format."
          products={rollOns}
          placeholder="roll-on"
          emptyState={<RollOnComingSoon />}
        />
      </div>
    </div>
  );
}
