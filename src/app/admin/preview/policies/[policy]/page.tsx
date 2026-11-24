import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageFrame, PageHeader } from "@/components/layout/PageHeader";
import { PolicyArticle } from "@/components/policies/PolicyArticle";
import { requireAdminPage } from "@/lib/auth/require-admin";
import { isPolicyKey, POLICY_DEFAULTS, POLICY_MODULES, policyPayloadSchema, toPolicyView } from "@/lib/cms/modules/policy-pages";
import { getEntry } from "@/lib/cms/service";
import { getDataServices } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Policy page preview", robots: { index: false, follow: false } };

function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="note" className="mx-auto my-6 max-w-xl rounded-xl border border-dashed border-[#d9c79f] bg-[#fffdf8] px-4 py-3 text-center text-[13.5px] text-brand-text/75">
      {children}
    </p>
  );
}

/**
 * Admin-only preview of a policy page (inside the admin PreviewFrame iframe):
 * the saved draft (?version=draft) or what the website shows now (?version=live).
 */
export default async function PolicyPreviewPage({ params, searchParams }: { params: Promise<{ policy: string }>; searchParams: Promise<{ version?: string }> }) {
  await requireAdminPage();
  const { policy } = await params;
  if (!isPolicyKey(policy)) notFound();
  const version = (await searchParams).version === "live" ? "live" : "draft";
  const data = getDataServices();
  const entry = data ? await getEntry(data.repo, POLICY_MODULES[policy], "main").catch(() => null) : null;

  let notice: ReactNode = null;
  let payload: unknown = null;
  if (!entry || (version === "live" && !entry.publishedAt)) {
    payload = POLICY_DEFAULTS[policy];
    notice = <Notice>Not published yet. The website shows this default text.</Notice>;
  } else {
    payload = version === "draft" ? entry.draft : entry.status === "PUBLISHED" ? entry.published : null;
    if (!payload) notice = <Notice>Deactivated: this page is hidden on the website and its footer link is removed.</Notice>;
  }
  const parsed = payload ? policyPayloadSchema.safeParse(payload) : null;
  const view = parsed?.success ? toPolicyView(policy, parsed.data) : null;

  return (
    <div data-preview={`policy-${policy}-${version}`}>
      {notice}
      {view ? (
        <PageFrame width="max-w-6xl">
          <PageHeader eyebrow="Customer care" title={view.title} intro={view.intro} />
          <PolicyArticle view={view} otherPolicies={[]} />
        </PageFrame>
      ) : payload ? (
        <Notice>This version cannot be displayed. Check the fields in the editor.</Notice>
      ) : null}
    </div>
  );
}
