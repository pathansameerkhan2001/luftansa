import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BrandStoryView } from "@/components/story/BrandStory";
import { requireAdminPage } from "@/lib/auth/require-admin";
import { getAssetUrl } from "@/lib/assets";
import { BRAND_STORY_DEFAULT, BRAND_STORY_MODULE, brandStoryPayloadSchema, toBrandStoryView } from "@/lib/cms/modules/brand-story";
import { getEntry } from "@/lib/cms/service";
import { getDataServices } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Brand Story preview", robots: { index: false, follow: false } };

function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="note" className="mx-auto my-6 max-w-xl rounded-xl border border-dashed border-[#d9c79f] bg-[#fffdf8] px-4 py-3 text-center text-[13.5px] text-brand-text/75">
      {children}
    </p>
  );
}

/**
 * Admin-only Brand Story preview (inside the admin PreviewFrame iframe), using
 * the real storefront section with the saved draft (?version=draft) or exactly
 * what the website shows now (?version=live). Never cached, never indexed.
 */
export default async function BrandStoryPreviewPage({ searchParams }: { searchParams: Promise<{ version?: string }> }) {
  await requireAdminPage();
  const version = (await searchParams).version === "live" ? "live" : "draft";
  const data = getDataServices();
  const entry = data ? await getEntry(data.repo, BRAND_STORY_MODULE, "main").catch(() => null) : null;

  let body: ReactNode;
  if (!entry || (version === "live" && !entry.publishedAt)) {
    body = (
      <>
        <BrandStoryView view={toBrandStoryView(BRAND_STORY_DEFAULT, getAssetUrl)} />
        <Notice>Not published yet. The website shows this default Brand Story.</Notice>
      </>
    );
  } else {
    const payload = version === "draft" ? entry.draft : entry.status === "PUBLISHED" ? entry.published : null;
    const parsed = payload ? brandStoryPayloadSchema.safeParse(payload) : null;
    body = !payload ? (
      <Notice>The Brand Story is deactivated: the website shows no Brand Story section.</Notice>
    ) : parsed?.success ? (
      <BrandStoryView view={toBrandStoryView(parsed.data, getAssetUrl)} />
    ) : (
      <Notice>This version cannot be displayed. Check the fields in the editor.</Notice>
    );
  }

  return (
    <main className="min-h-dvh bg-brand-ivory" data-preview={`brand-story-${version}`}>
      {body}
    </main>
  );
}
