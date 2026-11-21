import { Reveal } from "@/components/motion/Reveal";
import { loadPublished } from "@/lib/cms/loader";
import { HOME_COLLECTIONS_DEFAULT, HOME_COLLECTIONS_MODULE, resolveHomeCollections, toHomeCollectionsView, type HomeCollectionsView as View } from "@/lib/cms/modules/home-collections";
import { productHref } from "@/lib/routes";
import { getActiveStorefrontProducts } from "@/lib/storefront/products";
import { CollectionPanel } from "./CollectionPanel";

/**
 * The two collection panels side by side from xl (stacked below, in the
 * configured order). A single panel is centred at half width so its cards keep
 * their size. Renders nothing when there is nothing to show (no gap).
 */
export function HomeCollectionsView({ view }: { view: View }) {
  if (view.panels.length === 0) return null;
  const single = view.panels.length === 1;
  return (
    <div className="bg-brand-cream" data-home-collections>
      <div className={`mx-auto grid grid-cols-1 gap-8 px-4 pt-10 pb-12 sm:gap-10 sm:px-8 sm:pt-14 sm:pb-16 xl:gap-8 2xl:gap-10 ${single ? "max-w-[880px]" : "max-w-[1600px] xl:grid-cols-2"}`}>
        {view.panels.map((panel, i) => (
          <Reveal key={panel.key} className="group/reveal h-full" delayMs={i * 140}>
            <CollectionPanel panel={panel} decorative={view.decorative} imageRatio={view.imageRatio} badgePosition={view.badgePosition} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/** Product detail page of a card. */
export const cardHref = (slug: string) => productHref(slug) ?? `/products/${slug}`;

/**
 * Homepage collections: Personality (Perfumes only) and Roll On (Roll-On
 * products only), managed in Admin → Homepage Collections. Product facts come
 * from Admin → Products; the CMS record chooses the products and the look.
 */
export async function HomeCollections() {
  const [settings, products] = await Promise.all([
    loadPublished(HOME_COLLECTIONS_MODULE, [HOME_COLLECTIONS_DEFAULT]).then(resolveHomeCollections, () => HOME_COLLECTIONS_DEFAULT),
    getActiveStorefrontProducts(),
  ]);
  if (!settings) return null; // deactivated
  return <HomeCollectionsView view={toHomeCollectionsView(settings, products, cardHref)} />;
}
