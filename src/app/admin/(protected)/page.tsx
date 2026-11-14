import type { Metadata } from "next";
import { CheckCircle2, CircleAlert, ShieldCheck } from "lucide-react";
import { getSystemStatus } from "@/lib/admin/system-status";
import { requireAdminPage } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard" };

/** Metrics shown once real data exists. No numbers are displayed before then. */
const METRICS = [
  { label: "Total products", phase: 2 },
  { label: "Active products", phase: 2 },
  { label: "Low-stock products", phase: 2 },
  { label: "Total orders", phase: 6 },
  { label: "Pending orders", phase: 6 },
  { label: "Completed orders", phase: 6 },
  { label: "Total customers", phase: 6 },
] as const;

function StatusRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  const Icon = ok ? CheckCircle2 : CircleAlert;
  return (
    <li className="flex items-start gap-3 py-3">
      <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${ok ? "text-emerald-700" : "text-amber-700"}`} strokeWidth={1.75} />
      <div className="min-w-0">
        <p className="text-[14px] font-medium">{label}</p>
        <p className="text-[13px] break-words text-brand-text/65">{detail}</p>
      </div>
    </li>
  );
}

export default async function AdminDashboardPage() {
  const session = await requireAdminPage();
  const status = getSystemStatus();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.28em] text-[#7a5a2b] uppercase">Luftansa Admin</p>
          <h1 className="mt-1 font-serif text-[30px] leading-tight font-semibold sm:text-[34px]">Welcome back</h1>
          <p className="mt-1 flex items-center gap-1.5 text-[14px] text-brand-text/70">
            <ShieldCheck aria-hidden="true" className="size-4 text-brand-gold" strokeWidth={1.75} />
            Signed in as <span className="font-medium text-brand-black" data-admin-email>{session.email}</span>
          </p>
        </div>
      </div>

      <section aria-labelledby="overview-heading" className="mt-8">
        <h2 id="overview-heading" className="text-[12px] font-semibold tracking-[0.14em] text-brand-text/60 uppercase">
          Store overview
        </h2>
        <ul className="mt-3 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
          {METRICS.map((m) => (
            <li key={m.label} data-admin-metric className="rounded-2xl border border-[#e3d6bd] bg-[#fffdf8] p-4">
              <p className="text-[13px] text-brand-text/70">{m.label}</p>
              <p className="mt-2 font-serif text-[28px] leading-none font-semibold text-brand-text/30" aria-label="Not available yet">
                —
              </p>
              <p className="mt-2 text-[12px] text-brand-text/55">Connects in Phase {m.phase}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12.5px] text-brand-text/60">Figures appear only once real store data is connected. Nothing here is estimated.</p>
      </section>

      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section aria-labelledby="recent-orders-heading" className="rounded-2xl border border-[#e3d6bd] bg-[#fffdf8] p-5 sm:p-6">
          <h2 id="recent-orders-heading" className="font-serif text-[22px] font-semibold">Recent orders</h2>
          <p className="mt-2 text-[14px] text-brand-text/65">No orders to show. Order management is connected in Phase 6.</p>
        </section>
        <section aria-labelledby="recent-activity-heading" className="rounded-2xl border border-[#e3d6bd] bg-[#fffdf8] p-5 sm:p-6">
          <h2 id="recent-activity-heading" className="font-serif text-[22px] font-semibold">Recent activity</h2>
          <p className="mt-2 text-[14px] text-brand-text/65">
            Admin changes will be recorded in the audit log and listed here once the database is connected.
          </p>
        </section>
      </div>

      <section aria-labelledby="system-heading" className="mt-8 rounded-2xl border border-[#e3d6bd] bg-[#fffdf8] p-5 sm:p-6" data-admin-system>
        <h2 id="system-heading" className="font-serif text-[22px] font-semibold">System status</h2>
        <ul className="mt-2 divide-y divide-[#efe6d4]">
          <StatusRow ok label="Administrator authentication" detail="Amazon Cognito. This session is verified on every request." />
          <StatusRow
            ok={status.database.configured}
            label="Database (DynamoDB)"
            detail={status.database.configured ? `Configured: ${status.database.table} (${status.database.region}). Not yet used by admin features.` : "Not configured. Set DYNAMODB_TABLE and DYNAMODB_REGION (planned for Phase 2)."}
          />
          <StatusRow
            ok={status.storage.configured}
            label="Media storage (S3)"
            detail={status.storage.configured ? `Private bucket: ${status.storage.bucket}${status.storage.cdn ? " (via CDN)" : ""}.` : "Not configured."}
          />
          <StatusRow
            ok={status.credentials.mode === "vercel-oidc"}
            label="AWS credentials"
            detail={
              status.credentials.mode === "vercel-oidc"
                ? "Short-lived credentials via Vercel OIDC role."
                : status.credentials.usesLongLivedKeys
                  ? "Using long-lived access keys. Migration to a Vercel OIDC role is planned (awaiting approval)."
                  : "AWS SDK default credential chain."
            }
          />
        </ul>
      </section>
    </div>
  );
}
