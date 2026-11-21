import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cardHref, HomeCollectionsView } from "@/components/collection/HomeCollections";
import { requireAdminPage } from "@/lib/auth/require-admin";
import { HOME_COLLECTIONS_DEFAULT, HOME_COLLECTIONS_MODULE, homeCollectionsPayloadSchema, toHomeCollectionsView, type HomeCollectionsPayload } from "@/lib/cms/modules/home-collections";
import { getEntry } from "@/lib/cms/service";
import { getDataServices } from "@/lib/db/client";
import { getActiveStorefrontProducts } from "@/lib/storefront/products";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Homepage Collections preview", robots: { index: false, follow: false } };

function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="note" className="mx-auto my-6 max-w-xl rounded-xl border border-dashed border-[#d9c79f] bg-[#fffdf8] px-4 py-3 text-center text-[13.5px] text-brand-text/75">
      {children}
    </p>
  );
}

/**
 * Admin-only preview of the homepage collections (inside the admin
 * PreviewFrame iframe), using the real storefront panels and the current
 * active products with the saved draft (?version=draft) or exactly what the
 * website shows now (?version=live). Never cached, never indexed.
 */
export default async function CollectionsPreviewPage({ searchParams }: { searchParams: Promise<{ version?: string }> }) {
  await requireAdminPage();
  const version = (await searchParams).version === "live" ? "live" : "draft";
  const data = getDataServices();
  const [entry, products] = await Promise.all([data ? getEntry(data.repo, HOME_COLLECTIONS_MODULE, "main").catch(() => null) : null, getActiveStorefrontProducts()]);
  const render = (p: HomeCollectionsPayload) => {
    const view = toHomeCollectionsView(p, products, cardHref);
    return view.panels.length ? <HomeCollectionsView view={view} /> : <Notice>No collection has products to show: the homepage shows nothing here.</Notice>;
  };

  let body: ReactNode;
  if (!entry || (version === "live" && !entry.publishedAt)) {
    body = (
      <>
        {render(HOME_COLLECTIONS_DEFAULT)}
        <Notice>Not published yet. The website shows these default collections.</Notice>
      </>
    );
  } else {
    const payload = version === "draft" ? entry.draft : entry.status === "PUBLISHED" ? entry.published : null;
    const parsed = payload ? homeCollectionsPayloadSchema.safeParse(payload) : null;
    body = !payload ? (
      <Notice>The homepage collections are deactivated: the website shows neither panel.</Notice>
    ) : parsed?.success ? (
      render(parsed.data)
    ) : (
      <Notice>This version cannot be displayed. Check the fields in the editor.</Notice>
    );
  }

  return (
    <main className="min-h-dvh bg-brand-cream" data-preview={`collections-${version}`}>
      {body}
    </main>
  );
}
