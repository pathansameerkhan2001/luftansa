/**
 * Primary navigation data (server side): the default menu, and the menu built
 * from the published Collections Menu (Admin → Collections Menu). Kept apart
 * from ./nav-config so the header's client components never bundle the CMS
 * schemas.
 */
import { loadPublished } from "@/lib/cms/loader";
import { NAV_COLLECTIONS_DEFAULT, NAV_COLLECTIONS_MODULE, resolveNavCollections, toCollectionsMenu } from "@/lib/cms/modules/nav-collections";
import { buildPrimaryNav, type NavItem } from "./nav-config";

/** The navigation with the default Collections menu (before anything is published). */
export const PRIMARY_NAV: readonly NavItem[] = buildPrimaryNav(toCollectionsMenu(NAV_COLLECTIONS_DEFAULT));

/** The live navigation. Never throws: the default menu is used if the CMS cannot be read. */
export async function loadPrimaryNav(): Promise<NavItem[]> {
  try {
    const settings = await loadPublished(NAV_COLLECTIONS_MODULE, [NAV_COLLECTIONS_DEFAULT]).then(resolveNavCollections);
    return buildPrimaryNav(toCollectionsMenu(settings));
  } catch (e) {
    console.error("[nav] collections menu unavailable, using the default:", (e as Error).message);
    return [...PRIMARY_NAV];
  }
}
