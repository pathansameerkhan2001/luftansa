import Link from "next/link";

/** 404 inside the admin area (admin styling, no storefront chrome). */
export default function AdminNotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#e3d6bd] bg-[#fffdf8] p-8 text-center">
        <p className="text-[11px] font-semibold tracking-[0.28em] text-[#7a5a2b] uppercase">Luftansa Admin</p>
        <h1 className="mt-2 font-serif text-[30px] font-semibold text-brand-black">Page not found</h1>
        <p className="mt-2 text-[14px] text-brand-text/70">This admin page does not exist.</p>
        <Link
          href="/admin"
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-[#161513] px-5 text-[14px] font-medium text-white hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
