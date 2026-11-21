import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OurStoryView } from "@/components/our-story/OurStoryView";
import { STORE_NAME } from "@/data/store";
import { getAssetUrl } from "@/lib/assets";
import { loadPublished } from "@/lib/cms/loader";
import { hasAnySection, OUR_STORY_DEFAULT, OUR_STORY_MODULE, resolveOurStory, toOurStoryView } from "@/lib/cms/modules/our-story";

// Refreshed on publish (CMS cache tags); hourly safety net.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Our Story | ${STORE_NAME}`,
  description: "How Luftansa Fragrance Craft Hub began, and the careful process behind every fragrance.",
};

/** Where visitors go while the page is deactivated in Admin: the homepage brand story. */
const OUR_STORY_FALLBACK = "/#brand-story-heading";

/**
 * Our Story (Admin → Website → Our Story). Deactivated, or with every section
 * switched off, the page sends visitors to the homepage brand story so the
 * header and footer links never lead to an empty page.
 */
export default async function OurStoryPage() {
  const view = await loadPublished(OUR_STORY_MODULE, [OUR_STORY_DEFAULT]).then(
    (r) => resolveOurStory(r, getAssetUrl),
    () => toOurStoryView(OUR_STORY_DEFAULT, getAssetUrl),
  );
  if (!view || !hasAnySection(view)) redirect(OUR_STORY_FALLBACK);
  return (
    <main className="bg-brand-ivory">
      {view.hero ? null : <h1 className="sr-only">Our Story</h1>}
      <OurStoryView view={view} />
    </main>
  );
}
