import type { Metadata } from "next";
import type { ReactNode } from "react";
import { OurStoryView } from "@/components/our-story/OurStoryView";
import { requireAdminPage } from "@/lib/auth/require-admin";
import { getAssetUrl } from "@/lib/assets";
import { hasAnySection, OUR_STORY_DEFAULT, OUR_STORY_MODULE, ourStoryPayloadSchema, toOurStoryView } from "@/lib/cms/modules/our-story";
import { getEntry } from "@/lib/cms/service";
import { getDataServices } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Our Story preview", robots: { index: false, follow: false } };

function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="note" className="mx-auto my-6 max-w-xl rounded-xl border border-dashed border-[#d9c79f] bg-[#fffdf8] px-4 py-3 text-center text-[13.5px] text-brand-text/75">
      {children}
    </p>
  );
}

/**
 * Admin-only preview of the Our Story page (inside the admin PreviewFrame
 * iframe), using the real page sections with the saved draft
 * (?version=draft) or exactly what the website shows now (?version=live).
 * Never cached, never indexed.
 */
export default async function OurStoryPreviewPage({ searchParams }: { searchParams: Promise<{ version?: string }> }) {
  await requireAdminPage();
  const version = (await searchParams).version === "live" ? "live" : "draft";
  const data = getDataServices();
  const entry = data ? await getEntry(data.repo, OUR_STORY_MODULE, "main").catch(() => null) : null;

  let body: ReactNode;
  if (!entry || (version === "live" && !entry.publishedAt)) {
    body = (
      <>
        <Notice>Not published yet. The website shows this default Our Story content.</Notice>
        <OurStoryView view={toOurStoryView(OUR_STORY_DEFAULT, getAssetUrl)} />
      </>
    );
  } else {
    const payload = version === "draft" ? entry.draft : entry.status === "PUBLISHED" ? entry.published : null;
    const parsed = payload ? ourStoryPayloadSchema.safeParse(payload) : null;
    const view = parsed?.success ? toOurStoryView(parsed.data, getAssetUrl) : null;
    body = !payload ? (
      <Notice>The Our Story page is deactivated: visitors are sent to the brand story on the homepage.</Notice>
    ) : !view ? (
      <Notice>This version cannot be displayed. Check the fields in the editor.</Notice>
    ) : hasAnySection(view) ? (
      <OurStoryView view={view} />
    ) : (
      <Notice>Every section is switched off: visitors are sent to the brand story on the homepage.</Notice>
    );
  }

  return (
    <main className="min-h-dvh bg-brand-ivory" data-preview={`our-story-${version}`}>
      {body}
    </main>
  );
}
