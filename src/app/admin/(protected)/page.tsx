import { LogOut, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

/** Admin dashboard (placeholder): confirms the signed-in administrator. */
export default async function AdminDashboardPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <main className="mx-auto max-w-3xl px-4 py-14 sm:px-8 sm:py-20">
      <div className="rounded-[24px] border border-brand-gold/40 bg-brand-ivory p-6 shadow-[0_24px_48px_-32px_rgba(60,45,20,0.45)] sm:p-10">
        <p className="text-[11px] font-semibold tracking-[0.3em] text-brand-gold uppercase">Luftansa Admin Portal</p>
        <h1 className="mt-2 font-serif text-[32px] leading-tight font-semibold text-brand-black sm:text-[38px]">Dashboard</h1>
        <p className="mt-4 flex items-center gap-2 text-[14.5px] text-brand-text/85">
          <ShieldCheck aria-hidden="true" className="size-5 text-brand-gold" strokeWidth={1.75} />
          Signed in as <span className="font-semibold text-brand-black" data-admin-email>{session.email}</span>
        </p>
        <p className="mt-3 text-[13.5px] leading-relaxed text-brand-text/70">
          Admin tools will appear here. Your session is protected with Amazon Cognito and refreshes automatically while you
          are active.
        </p>

        <form action="/api/auth/logout" method="post" className="mt-8">
          <button
            type="submit"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-black px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
          >
            <LogOut aria-hidden="true" className="size-4" strokeWidth={1.75} />
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
