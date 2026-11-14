import { LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/server";
import { safeReturnTo } from "@/lib/auth/return-to";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  access_denied: "Sign-in was cancelled.",
  not_authorized: "This account is not authorised to access the Luftansa admin portal.",
  session_expired: "Your session has expired. Please sign in again.",
  invalid_state: "Your sign-in link has expired or was already used. Please try again.",
  expired_code: "Your sign-in link has expired. Please try again.",
  login_failed: "We could not complete sign-in. Please try again.",
  provider_error: "The sign-in service returned an error. Please try again.",
  config: "Admin sign-in is not configured yet.",
};

/** Diagnostic detail for a refused sign-in. Describes the signed-in user's OWN account only. */
const REASONS: Record<string, string> = {
  email_unverified:
    "Your email address is not verified in Amazon Cognito. Ask the site owner to verify it (Cognito > Users > Edit user > mark email as verified), then sign in again.",
  email_missing: "Your Cognito account did not provide an email address. The app client must be allowed to read the email attribute.",
  email_not_allowed: "Your email is verified, but it is not on the administrator list (ADMIN_EMAILS).",
};

/** Codes that are safe to echo back (anything else is ignored). */
const SAFE_CODE = /^[a-z_]{1,40}$/;

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string; returnTo?: string }>;
}) {
  const { error, reason, returnTo } = await searchParams;
  const reasonCode = reason && SAFE_CODE.test(reason) ? reason : undefined;
  const target = safeReturnTo(returnTo);
  if (await getAdminSession()) redirect(target);

  const message = error ? (ERRORS[error] ?? ERRORS.login_failed) : null;
  const loginHref = `/api/auth/login?returnTo=${encodeURIComponent(target)}`;

  return (
    <main className="flex justify-center px-4 py-16 sm:py-24">
      <div className="w-full max-w-md rounded-[24px] border border-brand-gold/40 bg-brand-ivory p-7 text-center shadow-[0_24px_48px_-32px_rgba(60,45,20,0.45)] sm:p-10">
        <span className="mx-auto inline-flex size-12 items-center justify-center rounded-full border border-brand-gold/60 text-brand-black">
          <LockKeyhole aria-hidden="true" className="size-5" strokeWidth={1.6} />
        </span>
        <p className="mt-4 text-[11px] font-semibold tracking-[0.3em] text-brand-gold uppercase">Luftansa Admin Portal</p>
        <h1 className="mt-2 font-serif text-[30px] leading-tight font-semibold text-brand-black">Administrator sign in</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-brand-text/75">
          Sign in with your Luftansa administrator account. You will be redirected to our secure sign-in page.
        </p>

        {message ? (
          <div role="alert" data-login-error={error} data-login-reason={reasonCode} className="mt-5 rounded-xl border border-red-800/20 bg-red-50 px-4 py-3 text-left text-[13.5px] text-red-900">
            <p>{message}</p>
            {reasonCode && REASONS[reasonCode] ? <p className="mt-1.5 text-red-900/80">{REASONS[reasonCode]}</p> : null}
            {reasonCode ? <p className="mt-1.5 font-mono text-[11.5px] text-red-900/60">Code: {error}/{reasonCode}</p> : null}
          </div>
        ) : null}

        {/* Plain link (no prefetch): the login route sets one-time state cookies. */}
        <a
          href={loginHref}
          className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-xl bg-brand-black text-[15px] font-semibold text-white transition-colors hover:bg-brand-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
        >
          Sign in with Cognito
        </a>
      </div>
    </main>
  );
}
