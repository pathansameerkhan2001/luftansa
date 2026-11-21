import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/header/SiteHeader";
import { FallbackHero, renderHeroPayload } from "@/components/hero/HeroSection";
import { requireAdminPage } from "@/lib/auth/require-admin";
import { HERO_MODULE } from "@/lib/cms/modules/hero";
import { getEntry } from "@/lib/cms/service";
import { getDataServices } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hero preview", robots: { index: false, follow: false } };

function Notice({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p role="note" className={`mx-auto my-6 max-w-xl rounded-xl border border-dashed border-[#d9c79f] bg-[#fffdf8] px-4 py-3 text-center text-[13.5px] text-brand-text/75 ${className}`}>
      {children}
    </p>
  );
}

/**
 * Admin-only hero preview (rendered inside the admin PreviewFrame iframe).
 * Uses the real storefront header and hero components with the saved draft
 * (?version=draft) or exactly what the website shows now (?version=live).
 * Never cached and never indexed; outside the admin shell so it looks like the storefront.
 */
export default async function HeroPreviewPage({ searchParams }: { searchParams: Promise<{ version?: string }> }) {
  await requireAdminPage();
  const version = (await searchParams).version === "live" ? "live" : "draft";
  const data = getDataServices();
  const entry = data ? await getEntry(data.repo, HERO_MODULE, "main").catch(() => null) : null;

  let body: ReactNode;
  if (!entry) {
    body = (
      <>
        <FallbackHero />
        <Notice>Nothing has been saved yet. This is the default hero the website shows today.</Notice>
      </>
    );
  } else if (version === "draft") {
    body = (
      <>
        {renderHeroPayload(entry.draft, entry.visibility) ?? null}
        {!entry.visibility.mobile ? <Notice className="sm:hidden">Hidden on phones (visibility setting).</Notice> : null}
        {!entry.visibility.desktop ? <Notice className="hidden sm:block">Hidden on tablets and desktops (visibility setting).</Notice> : null}
      </>
    );
  } else if (entry.status === "PUBLISHED" && entry.published) {
    body = renderHeroPayload(entry.published, entry.visibility);
  } else if (entry.publishedAt) {
    body = <Notice>The hero is inactive: the website currently shows no hero.</Notice>;
  } else {
    body = (
      <>
        <FallbackHero />
        <Notice>Not published yet. The website shows this default hero.</Notice>
      </>
    );
  }

  return (
    <div className="min-h-dvh bg-brand-ivory" data-preview={`hero-${version}`}>
      <SiteHeader />
      <main>{body}</main>
    </div>
  );
}
