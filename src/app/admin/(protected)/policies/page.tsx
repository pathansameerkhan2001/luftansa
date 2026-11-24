import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ExternalLink, FileText } from "lucide-react";
import { PageIntro } from "@/components/admin/cms/ui";
import { requireAdminPage } from "@/lib/auth/require-admin";
import { POLICY_KEYS, POLICY_LABEL, POLICY_MODULES, POLICY_ROUTE } from "@/lib/cms/modules/policy-pages";
import { getEntry } from "@/lib/cms/service";
import { getDataServices } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Policy Pages" };

const STATUS = {
  default: { label: "Default text", tone: "border-[#d9c79f] bg-brand-cream text-brand-text/80" },
  draft: { label: "Draft · not live", tone: "border-[#e5c98f] bg-[#fdf4e2] text-[#7a5a2b]" },
  live: { label: "Live", tone: "border-[#b9d4b3] bg-[#eef6ec] text-[#2f5f2a]" },
  "live-changes": { label: "Live · draft changes saved", tone: "border-[#e5c98f] bg-[#fdf4e2] text-[#7a5a2b]" },
  inactive: { label: "Inactive (hidden)", tone: "border-[#161513] bg-[#161513] text-[#e9d6ab]" },
} as const;

/** Admin → Website → Policy Pages: the four customer policy pages and their status. */
export default async function AdminPoliciesPage() {
  await requireAdminPage();
  const data = getDataServices();
  const entries = await Promise.all(POLICY_KEYS.map((k) => (data ? getEntry(data.repo, POLICY_MODULES[k], "main").catch(() => null) : Promise.resolve(null))));

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Website"
        title="Policy Pages"
        description="Shipping, Return, Privacy and Terms pages, linked from the footer and the FAQs. Until you publish, each page shows default text that states only what the website already says. Open a page to complete it with your own policy details."
      />
      <ul className="divide-y divide-[#eee3cc] overflow-hidden rounded-2xl border border-[#e3d6bd] bg-white">
        {POLICY_KEYS.map((k, i) => {
          const e = entries[i];
          const state = !e ? "default" : e.status === "UNPUBLISHED" ? "inactive" : e.status === "PUBLISHED" ? (e.hasUnpublishedChanges ? "live-changes" : "live") : "draft";
          const s = STATUS[state];
          return (
            <li key={k} className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-6" data-policy-row={k}>
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-brand-gold/30 bg-brand-cream text-brand-text/70">
                <FileText className="size-4.5" strokeWidth={1.5} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-serif text-[19px] font-semibold text-brand-black">{POLICY_LABEL[k]}</p>
                <p className="text-[12.5px] text-brand-text/60">{POLICY_ROUTE[k]}</p>
              </div>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${s.tone}`}>{s.label}</span>
              <a href={POLICY_ROUTE[k]} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#d9c79f] px-3 text-[13px] font-medium text-brand-black hover:border-brand-black">
                View <ExternalLink className="size-3.5" />
                <span className="sr-only"> {POLICY_LABEL[k]} (opens in a new tab)</span>
              </a>
              <Link href={`/admin/policies/${k}`} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-black px-4 text-[13px] font-semibold text-white hover:bg-brand-text">
                Edit<span className="sr-only"> {POLICY_LABEL[k]}</span> <ChevronRight className="size-4" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
