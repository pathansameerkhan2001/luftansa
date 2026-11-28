import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CollectionListing } from "@/components/collection/CollectionListing";
import { SectionListing } from "@/components/collection/SectionListing";
import { requireAdminPage } from "@/lib/auth/require-admin";
import { collectionHref, NAV_COLLECTIONS_DEFAULT, NAV_COLLECTIONS_MODULE, navCollectionsPayloadSchema, selectNavCollectionProducts, type NavCollectionsPayload } from "@/lib/cms/modules/nav-collections";
import { getEntry } from "@/lib/cms/service";
import { getDataServices } from "@/lib/db/client";
import { getActiveStorefrontProducts, toStorefrontCardData } from "@/lib/storefront/products";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Collections Menu preview", robots: { index: false, follow: false } };

function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="note" className="mx-auto my-6 max-w-xl rounded-xl border border-dashed border-[#d9c79f] bg-[#fffdf8] px-4 py-3 text-center text-[13.5px] text-brand-text/75">
      {children}
    </p>
  );
}

/** The dropdown's links, as the header lists them (inactive ones marked). */
function MenuSample({ payload }: { payload: NavCollectionsPayload }) {
  return (
    <div className="mx-auto mt-6 max-w-md border border-brand-gold/30 bg-brand-ivory py-2 shadow-[0_12px_32px_-12px_rgba(22,21,19,0.25)]">
      <p className="px-5 pb-2 text-[11px] font-medium tracking-[0.24em] text-brand-text/60 uppercase">{payload.menuLabel} menu</p>
      <ul>
        {payload.collections.map((c) => (
          <li key={c.id} className={`flex items-center justify-between gap-3 px-5 py-2.5 text-[12px] font-medium tracking-[0.16em] uppercase ${c.enabled ? "text-brand-black" : "text-brand-text/40 line-through"}`}>
            {c.name}
            <span className="text-[11px] tracking-normal normal-case text-brand-text/55 no-underline">{c.enabled ? collectionHref(c) : "inactive: hidden"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Admin-only preview of the Collections Menu (inside the admin PreviewFrame
 * iframe): the dropdown's links and the selected collection's page, from the
 * saved draft (?version=draft) or exactly what the website shows now
 * (?version=live). Never cached, never indexed.
 */
export default async function NavCollectionsPreviewPage({ searchParams }: { searchParams: Promise<{ version?: string; slug?: string }> }) {
  await requireAdminPage();
  const params = await searchParams;
  const version = params.version === "live" ? "live" : "draft";
  const data = getDataServices();
  const [entry, products] = await Promise.all([data ? getEntry(data.repo, NAV_COLLECTIONS_MODULE, "main").catch(() => null) : null, getActiveStorefrontProducts()]);

  let payload: NavCollectionsPayload | null = null;
  let notice: ReactNode = null;
  if (!entry || (version === "live" && !entry.publishedAt)) {
    payload = NAV_COLLECTIONS_DEFAULT;
    notice = <Notice>Not published yet. The website shows this default menu.</Notice>;
  } else {
    const raw = version === "draft" ? entry.draft : entry.status === "PUBLISHED" ? entry.published : null;
    if (!raw) notice = <Notice>Deactivated: the header shows no COLLECTIONS menu and collection pages are offline.</Notice>;
    else {
      const parsed = navCollectionsPayloadSchema.safeParse(raw);
      if (parsed.success) payload = parsed.data;
      else notice = <Notice>This version cannot be displayed. Check the fields in the editor.</Notice>;
    }
  }

  const collection = payload?.collections.find((c) => c.slug === params.slug) ?? payload?.collections[0];
  let page: ReactNode = null;
  if (collection) {
    if (!collection.enabled) page = <Notice>{collection.name} is inactive: it is not in the menu and its page is offline.</Notice>;
    else if (collection.linkTo === "/roll-on") page = <SectionListing section="roll-on" />;
    else if (collection.linkTo) page = <Notice>The menu opens the existing page {collection.linkTo}.</Notice>;
    else page = <CollectionListing collection={collection} products={selectNavCollectionProducts(collection, products).map(toStorefrontCardData)} />;
  }

  return (
    <div className="min-h-dvh bg-brand-cream" data-preview={`nav-collections-${version}`}>
      {payload ? <MenuSample payload={payload} /> : null}
      {notice}
      {page}
    </div>
  );
}
