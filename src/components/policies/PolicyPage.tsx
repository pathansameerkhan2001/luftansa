import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs, PageFrame, PageHeader } from "@/components/layout/PageHeader";
import { STORE_NAME } from "@/data/store";
import { POLICY_LABEL, type PolicyKey } from "@/lib/cms/modules/policy-pages";
import { livePolicyLinks, loadPolicy } from "@/lib/storefront/policies";
import { PolicyArticle } from "./PolicyArticle";

export async function policyMetadata(key: PolicyKey): Promise<Metadata> {
  const view = await loadPolicy(key);
  if (!view) return { title: `Page not found | ${STORE_NAME}`, robots: { index: false } };
  return { title: `${view.title} | ${STORE_NAME}`, description: view.intro ?? `${POLICY_LABEL[key]} of ${STORE_NAME}.` };
}

/** A customer policy page (Admin → Website → Policy Pages). Deactivated → 404. */
export async function PolicyPage({ policy }: { policy: PolicyKey }) {
  const [view, links] = await Promise.all([loadPolicy(policy), livePolicyLinks()]);
  if (!view) notFound();
  return (
    <PageFrame width="max-w-6xl">
      <Breadcrumbs crumbs={[{ label: view.title }]} />
      <PageHeader eyebrow="Customer care" title={view.title} intro={view.intro} />
      <PolicyArticle view={view} otherPolicies={links.map((l) => l.key).filter((k) => k !== policy)} />
    </PageFrame>
  );
}
