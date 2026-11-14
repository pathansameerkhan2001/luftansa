import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  CircleAlert,
  Database,
  History,
  Lock,
  Package,
  Server,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Users,
} from "lucide-react";
import { HERO_BANNER } from "@/components/hero/hero-banner";
import { getSystemStatus } from "@/lib/admin/system-status";
import { requireAdminPage } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard" };

/** Metrics shown once real data exists. No numbers are displayed before then. */
const METRICS = [
  { label: "Total products", phase: 2, icon: Package },
  { label: "Active products", phase: 2, icon: Sparkles },
  { label: "Low-stock products", phase: 2, icon: Boxes },
  { label: "Total orders", phase: 6, icon: ShoppingCart },
  { label: "Pending orders", phase: 6, icon: ShoppingCart },
  { label: "Completed orders", phase: 6, icon: ShoppingCart },
  { label: "Total customers", phase: 6, icon: Users },
] as const;

function StatusRow({ ok, label, detail, icon: RowIcon }: { ok: boolean; label: string; detail: string; icon: typeof CheckCircle2 }) {
  const StatusIcon = ok ? CheckCircle2 : CircleAlert;
  return (
    <li className="flex items-start gap-3.5 py-4 first:pt-2 last:pb-2">
      <div className={`mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl ${ok ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20" : "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20"}`}>
        <RowIcon aria-hidden="true" className="size-4.5" strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[14px] font-semibold text-brand-black">{label}</p>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${ok ? "bg-emerald-100/70 text-emerald-800" : "bg-amber-100/70 text-amber-800"}`}>
            <StatusIcon aria-hidden="true" className="size-3" strokeWidth={2.5} />
            {ok ? "Connected" : "Pending setup"}
          </span>
        </div>
        <p className="mt-1 text-[13px] break-words text-brand-text/70">{detail}</p>
      </div>
    </li>
  );
}

export default async function AdminDashboardPage() {
  const session = await requireAdminPage();
  const status = getSystemStatus();

  return (
    <div className="mx-auto max-w-6xl space-y-9">
      {/* =========================================================================
          HERO SECTION: Luxury editorial layout with approved fragrance hero texture
          ========================================================================= */}
      <section
        aria-labelledby="hero-welcome-heading"
        className="relative overflow-hidden rounded-[26px] border border-[#c6a76a]/35 bg-gradient-to-br from-[#1c1b18] via-[#171614] to-[#100f0d] p-6 shadow-[0_24px_50px_-20px_rgba(23,20,15,0.45)] sm:p-8 lg:p-10"
      >
        {/* Approved existing fragrance hero asset texture overlay */}
        {HERO_BANNER.src ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-20 mix-blend-overlay">
            <Image
              src={HERO_BANNER.src}
              alt=""
              fill
              sizes="(min-width: 1200px) 1100px, 100vw"
              className="object-cover"
              priority
            />
          </div>
        ) : null}

        {/* Ambient champagne gold glow accents */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-[#c6a76a]/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full bg-[#c6a76a]/10 blur-3xl"
        />

        <div className="relative grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.5fr_1fr]">
          {/* Left Column: Welcome messaging, email badge, navigation CTA */}
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#c6a76a]/40 bg-[#c6a76a]/10 px-3.5 py-1 text-[11px] font-semibold tracking-[0.24em] text-[#e9d6ab] uppercase">
              <Sparkles aria-hidden="true" className="size-3 text-[#c6a76a]" />
              <span>Luftansa Fragrance Craft Hub</span>
            </div>

            <h1
              id="hero-welcome-heading"
              className="mt-4 font-serif text-[32px] leading-[1.1] font-semibold tracking-[0.01em] text-white sm:text-[40px] lg:text-[44px]"
            >
              Welcome back, Administrator
            </h1>

            <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-[#f8f5ec]/80 sm:text-[15.5px]">
              Manage your fragrances, inventory and store experience.
            </p>

            {/* Administrator identity row */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3.5 py-1.5 backdrop-blur-md">
                <ShieldCheck aria-hidden="true" className="size-4 text-[#c6a76a]" strokeWidth={1.8} />
                <span className="text-[13px] text-[#f8f5ec]/80">
                  Signed in as <strong className="font-semibold text-white" data-admin-email>{session.email}</strong>
                </span>
              </div>
            </div>

            {/* Quick action CTAs */}
            <div className="mt-7 flex flex-wrap items-center gap-3.5">
              <Link
                href="/admin/products"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#c6a76a] via-[#d6bc83] to-[#c6a76a] px-5 py-3 text-[14px] font-semibold text-[#171717] shadow-[0_4px_16px_rgba(198,167,106,0.35)] transition-all hover:brightness-105 hover:shadow-[0_6px_22px_rgba(198,167,106,0.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c6a76a]"
              >
                <Package aria-hidden="true" className="size-4" strokeWidth={1.8} />
                <span>Manage Products</span>
                <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
              <Link
                href="/admin/inventory"
                className="inline-flex items-center gap-2 rounded-xl border border-[#c6a76a]/40 bg-white/5 px-4 py-3 text-[14px] font-medium text-[#f8f5ec] backdrop-blur-sm transition-colors hover:border-[#c6a76a]/70 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c6a76a]"
              >
                <Boxes aria-hidden="true" className="size-4 text-[#c6a76a]" strokeWidth={1.8} />
                <span>Stock &amp; Inventory</span>
              </Link>
            </div>
          </div>

          {/* Right Column: Editorial brand highlight card */}
          <div className="relative hidden lg:block">
            <div className="rounded-2xl border border-[#c6a76a]/30 bg-black/40 p-6 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.2em] text-[#c6a76a] uppercase">Store Status</p>
                  <p className="mt-0.5 font-serif text-[18px] font-semibold text-white">Live Storefront</p>
                </div>
                <span className="inline-flex size-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" aria-hidden="true" />
              </div>
              <ul className="mt-4 space-y-3 text-[13px] text-[#f8f5ec]/75">
                <li className="flex items-center justify-between">
                  <span>Fragrance Catalog</span>
                  <span className="font-semibold text-white">41 Scents Planned</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Admin Portal</span>
                  <span className="font-semibold text-[#e9d6ab]">Phase 1 Active</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Product Management</span>
                  <span className="font-semibold text-white/60">Phase 2 Next</span>
                </li>
              </ul>
              <div className="mt-5 border-t border-white/10 pt-4">
                <Link
                  href="/"
                  target="_blank"
                  className="flex items-center justify-between text-[12.5px] font-medium text-[#c6a76a] transition-colors hover:text-[#e9d6ab]"
                >
                  <span>Preview Storefront</span>
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          STORE OVERVIEW / STATISTICS CARDS
          ========================================================================= */}
      <section aria-labelledby="overview-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 id="overview-heading" className="text-[12px] font-semibold tracking-[0.18em] text-[#7a5a2b] uppercase">
              Store overview
            </h2>
            <p className="mt-1 font-serif text-[24px] font-semibold text-brand-black sm:text-[26px]">Key Performance Metrics</p>
          </div>
          <span className="text-[12.5px] text-brand-text/60">
            Real figures connect in Phase 2 &amp; 6 · Zero fabricated data
          </span>
        </div>

        <ul className="mt-4 grid grid-cols-1 gap-3.5 min-[480px]:grid-cols-2 lg:grid-cols-4">
          {METRICS.map((m) => {
            const Icon = m.icon;
            return (
              <li
                key={m.label}
                data-admin-metric
                className="group relative flex flex-col justify-between rounded-2xl border border-[#e3d6bd] bg-[#fffdf8] p-5 shadow-[0_2px_8px_-2px_rgba(40,30,15,0.04)] transition-all hover:border-[#c6a76a]/60 hover:shadow-[0_4px_16px_-4px_rgba(198,167,106,0.15)]"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex size-9 items-center justify-center rounded-xl bg-brand-cream text-brand-text/70 ring-1 ring-brand-gold/30 transition-colors group-hover:bg-[#161513] group-hover:text-[#c6a76a]">
                      <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />
                    </span>
                    <span className="inline-flex items-center rounded-full border border-brand-gold/40 bg-brand-cream/80 px-2.5 py-0.5 text-[10.5px] font-semibold tracking-[0.06em] text-[#7a5a2b] uppercase">
                      Phase {m.phase}
                    </span>
                  </div>
                  <p className="mt-4 text-[13.5px] font-medium text-brand-text/80">{m.label}</p>
                </div>
                <div className="mt-4 border-t border-[#f0e6d2] pt-3">
                  <p className="font-serif text-[30px] leading-none font-semibold text-brand-text/30" aria-label="Not available yet">
                    —
                  </p>
                  <p className="mt-2 text-[11.5px] text-brand-text/55">Connects in Phase {m.phase}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* =========================================================================
          RECENT ORDERS & RECENT ACTIVITY: Honest empty states & Phase indicators
          ========================================================================= */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="recent-orders-heading"
          className="flex flex-col justify-between rounded-2xl border border-[#e3d6bd] bg-[#fffdf8] p-6 shadow-[0_2px_8px_-2px_rgba(40,30,15,0.04)] sm:p-7"
        >
          <div>
            <div className="flex items-center justify-between border-b border-[#f0e6d2] pb-4">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex size-9 items-center justify-center rounded-xl bg-brand-cream text-[#7a5a2b] ring-1 ring-brand-gold/30">
                  <ShoppingCart aria-hidden="true" className="size-4.5" strokeWidth={1.75} />
                </span>
                <h2 id="recent-orders-heading" className="font-serif text-[22px] font-semibold text-brand-black">
                  Recent orders
                </h2>
              </div>
              <span className="inline-flex items-center rounded-full border border-brand-gold/40 bg-brand-cream px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.06em] text-[#7a5a2b] uppercase">
                Planned · Phase 6
              </span>
            </div>
            <div className="py-8 text-center sm:py-10">
              <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full border border-brand-gold/30 bg-brand-cream/60 text-brand-text/45">
                <ShoppingCart aria-hidden="true" className="size-5" strokeWidth={1.5} />
              </div>
              <p className="mt-3.5 text-[14.5px] font-medium text-brand-black">No orders placed yet</p>
              <p className="mx-auto mt-1 max-w-sm text-[13.5px] leading-relaxed text-brand-text/65">
                No orders to show. Order management is connected in Phase 6.
              </p>
            </div>
          </div>
          <div className="border-t border-[#f0e6d2] pt-4">
            <Link
              href="/admin/orders"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-black transition-colors hover:text-brand-gold"
            >
              <span>View Orders Roadmap</span>
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
        </section>

        <section
          aria-labelledby="recent-activity-heading"
          className="flex flex-col justify-between rounded-2xl border border-[#e3d6bd] bg-[#fffdf8] p-6 shadow-[0_2px_8px_-2px_rgba(40,30,15,0.04)] sm:p-7"
        >
          <div>
            <div className="flex items-center justify-between border-b border-[#f0e6d2] pb-4">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex size-9 items-center justify-center rounded-xl bg-brand-cream text-[#7a5a2b] ring-1 ring-brand-gold/30">
                  <History aria-hidden="true" className="size-4.5" strokeWidth={1.75} />
                </span>
                <h2 id="recent-activity-heading" className="font-serif text-[22px] font-semibold text-brand-black">
                  Recent activity
                </h2>
              </div>
              <span className="inline-flex items-center rounded-full border border-brand-gold/40 bg-brand-cream px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.06em] text-[#7a5a2b] uppercase">
                Audit Trail
              </span>
            </div>
            <div className="py-8 text-center sm:py-10">
              <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full border border-brand-gold/30 bg-brand-cream/60 text-brand-text/45">
                <History aria-hidden="true" className="size-5" strokeWidth={1.5} />
              </div>
              <p className="mt-3.5 text-[14.5px] font-medium text-brand-black">No recent changes logged</p>
              <p className="mx-auto mt-1 max-w-sm text-[13.5px] leading-relaxed text-brand-text/65">
                Admin changes will be recorded in the audit log and listed here once the database is connected.
              </p>
            </div>
          </div>
          <div className="border-t border-[#f0e6d2] pt-4">
            <span className="text-[12.5px] text-brand-text/55">Immutable monthly partition schema prepared</span>
          </div>
        </section>
      </div>

      {/* =========================================================================
          SYSTEM STATUS SECTION
          ========================================================================= */}
      <section
        aria-labelledby="system-heading"
        className="rounded-2xl border border-[#e3d6bd] bg-[#fffdf8] p-6 shadow-[0_2px_8px_-2px_rgba(40,30,15,0.04)] sm:p-7"
        data-admin-system
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f0e6d2] pb-4">
          <div>
            <h2 id="system-heading" className="font-serif text-[22px] font-semibold text-brand-black">
              System status
            </h2>
            <p className="mt-0.5 text-[13px] text-brand-text/65">Current infrastructure and service verification</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-gold/40 bg-brand-cream px-3 py-1 text-[11.5px] font-semibold tracking-wide text-[#7a5a2b] uppercase">
            <Lock aria-hidden="true" className="size-3 text-[#c6a76a]" strokeWidth={2} />
            Verified Admin Environment
          </span>
        </div>

        <ul className="mt-2 divide-y divide-[#efe6d4]">
          <StatusRow
            ok
            label="Administrator authentication"
            detail="Amazon Cognito. This session is verified on every request."
            icon={CheckCircle2}
          />
          <StatusRow
            ok={status.database.configured}
            label="Database (DynamoDB)"
            detail={
              status.database.configured
                ? `Configured: ${status.database.table} (${status.database.region}). Not yet used by admin features.`
                : "Not configured. Set DYNAMODB_TABLE and DYNAMODB_REGION (planned for Phase 2)."
            }
            icon={Database}
          />
          <StatusRow
            ok={status.storage.configured}
            label="Media storage (S3)"
            detail={
              status.storage.configured
                ? `Private bucket: ${status.storage.bucket}${status.storage.cdn ? " (via CDN)" : ""}.`
                : "Not configured."
            }
            icon={Server}
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
            icon={ShieldCheck}
          />
        </ul>
      </section>
    </div>
  );
}
