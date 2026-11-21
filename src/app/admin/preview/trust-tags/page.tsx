import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TrustTags } from "@/components/product/TrustTags";
import { requireAdminPage } from "@/lib/auth/require-admin";
import { TRUST_TAGS_DEFAULT, TRUST_TAGS_MODULE, toTrustTagsView, trustTagsPayloadSchema } from "@/lib/cms/modules/trust-tags";
import { getEntry } from "@/lib/cms/service";
import { getDataServices } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Product Trust Tags preview", robots: { index: false, follow: false } };

function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="note" className="mx-auto my-6 max-w-xl rounded-xl border border-dashed border-[#d9c79f] bg-[#fffdf8] px-4 py-3 text-center text-[13.5px] text-brand-text/75">
      {children}
    </p>
  );
}

/** A sample DETAILS section, as product pages show it, with the trust tags. */
function DetailsSample({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[560px] px-4 py-6">
      <p className="border-b border-brand-gold/30 py-4 text-[14px] font-semibold tracking-[0.12em] text-brand-black uppercase">Details</p>
      <dl className="mt-4 divide-y divide-brand-gold/20 text-[14.5px]">
        {[
          ["Fragrance", "Sample fragrance"],
          ["Type", "Perfume"],
          ["Available sizes", "30 ml · 50 ml · 100 ml"],
        ].map(([t, v]) => (
          <div key={t} className="flex justify-between gap-4 py-2.5 first:pt-0">
            <dt className="text-brand-text/65">{t}</dt>
            <dd className="text-right font-medium text-brand-black">{v}</dd>
          </div>
        ))}
      </dl>
      {children}
    </div>
  );
}

/**
 * Admin-only preview of the trust tags (inside the admin PreviewFrame iframe):
 * the saved draft (?version=draft) or exactly what product pages show now
 * (?version=live). Never cached, never indexed.
 */
export default async function TrustTagsPreviewPage({ searchParams }: { searchParams: Promise<{ version?: string }> }) {
  await requireAdminPage();
  const version = (await searchParams).version === "live" ? "live" : "draft";
  const data = getDataServices();
  const entry = data ? await getEntry(data.repo, TRUST_TAGS_MODULE, "main").catch(() => null) : null;

  let body: ReactNode;
  if (!entry || (version === "live" && !entry.publishedAt)) {
    body = (
      <DetailsSample>
        <TrustTags tags={toTrustTagsView(TRUST_TAGS_DEFAULT)} />
        <Notice>Not published yet. Product pages show these default tags.</Notice>
      </DetailsSample>
    );
  } else {
    const payload = version === "draft" ? entry.draft : entry.status === "PUBLISHED" ? entry.published : null;
    const parsed = payload ? trustTagsPayloadSchema.safeParse(payload) : null;
    const tags = parsed?.success ? toTrustTagsView(parsed.data) : [];
    body = (
      <DetailsSample>
        {!payload ? (
          <Notice>Deactivated: product pages show no trust tags.</Notice>
        ) : !parsed?.success ? (
          <Notice>This version cannot be displayed. Check the fields in the editor.</Notice>
        ) : tags.length ? (
          <TrustTags tags={tags} />
        ) : (
          <Notice>Every tag is switched off: product pages show none.</Notice>
        )}
      </DetailsSample>
    );
  }

  return (
    <main className="min-h-dvh bg-brand-ivory" data-preview={`trust-tags-${version}`}>
      {body}
    </main>
  );
}
