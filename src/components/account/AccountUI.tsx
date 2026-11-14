import Link from "next/link";
import { Info, LockKeyhole, Mail, MessageCircle, Package, Phone, ReceiptText, UserRound, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CONTACT, mailHref, telHref, whatsappHref } from "@/data/store";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold";

/** Page frame shared by all account pages (breadcrumb, title, sub-navigation). */
export function AccountShell({
  title,
  current,
  crumbs,
  children,
}: {
  title: string;
  current: "overview" | "orders";
  crumbs: { label: string; href?: string }[];
  children: ReactNode;
}) {
  const tabs = [
    { key: "overview", label: "Account", href: "/account" },
    { key: "orders", label: "Orders", href: "/account/orders" },
  ] as const;
  return (
    <main className="bg-brand-ivory">
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-16 sm:px-8 sm:pt-8 sm:pb-20">
        <nav aria-label="Breadcrumb" className="text-[12.5px] text-brand-text/65">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-brand-black hover:underline">
                Home
              </Link>
            </li>
            {crumbs.map((c) => (
              <li key={c.label} className="flex items-center gap-1.5">
                <span aria-hidden="true">/</span>
                {c.href ? (
                  <Link href={c.href} className="hover:text-brand-black hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-brand-black">
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-b border-brand-gold/30 pb-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.3em] text-brand-gold uppercase">Luftansa</p>
            <h1 className="mt-1 font-serif text-[34px] leading-tight font-semibold text-brand-black sm:text-[40px]">{title}</h1>
          </div>
          <nav aria-label="Account sections">
            <ul className="flex gap-1">
              {tabs.map((t) => (
                <li key={t.key}>
                  <Link
                    href={t.href}
                    aria-current={t.key === current ? "page" : undefined}
                    className={`inline-flex h-9 items-center rounded-full px-4 text-[13px] font-medium transition-colors ${FOCUS} ${
                      t.key === current ? "bg-brand-black text-white" : "border border-brand-gold/45 text-brand-text hover:border-brand-gold"
                    }`}
                  >
                    {t.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="mt-7 sm:mt-8">{children}</div>
      </div>
    </main>
  );
}

/** Clear, non-alarming notice that customer accounts are not live yet. */
export function SetupNotice({ id = "account-setup-notice" }: { id?: string }) {
  return (
    <div id={id} role="status" data-account-setup className="flex gap-3 rounded-2xl border border-brand-gold/50 bg-brand-cream px-4 py-4 sm:px-5">
      <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-gold" strokeWidth={1.75} />
      <div className="text-[14px] leading-relaxed text-brand-text/85">
        <p className="font-semibold text-brand-black">Customer accounts are being set up</p>
        <p className="mt-1">
          Online sign-in and registration are not available yet, so no account can be created or accessed here at the
          moment. For orders, order updates or any help, please contact us directly.
        </p>
        <ContactLinks />
      </div>
    </div>
  );
}

export function ContactLinks() {
  const link = `inline-flex items-center gap-1.5 text-[13.5px] font-medium text-brand-black underline decoration-brand-gold/60 underline-offset-4 hover:decoration-brand-black ${FOCUS}`;
  return (
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
      <li>
        <a href={whatsappHref("Hello Luftansa, I need help with my order.")} target="_blank" rel="noopener noreferrer" className={link}>
          <MessageCircle aria-hidden="true" className="size-4 text-brand-gold" strokeWidth={1.75} />
          WhatsApp<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </li>
      <li>
        <a href={mailHref} className={link}>
          <Mail aria-hidden="true" className="size-4 text-brand-gold" strokeWidth={1.75} />
          {CONTACT.email}
        </a>
      </li>
      <li>
        <a href={telHref} className={link}>
          <Phone aria-hidden="true" className="size-4 text-brand-gold" strokeWidth={1.75} />
          {CONTACT.phone}
        </a>
      </li>
    </ul>
  );
}

const fieldClass =
  "mt-1.5 h-11 w-full rounded-xl border border-brand-gold/40 bg-white px-3.5 text-[14.5px] text-brand-black placeholder:text-brand-text/40 disabled:cursor-not-allowed disabled:bg-brand-cream/60 disabled:text-brand-text/50";

function Field({ id, label, type = "text", autoComplete }: { id: string; label: string; type?: string; autoComplete: string }) {
  return (
    <div>
      <label htmlFor={id} className="text-[13px] font-medium text-brand-black">
        {label}
      </label>
      <input id={id} name={id} type={type} autoComplete={autoComplete} disabled className={fieldClass} />
    </div>
  );
}

/**
 * Sign-in / registration form shells. While customer authentication is not
 * configured every control is disabled and points to the setup notice, so the
 * page never pretends that login or registration works.
 */
export function AuthCard({ mode, enabled }: { mode: "signin" | "register"; enabled: boolean }) {
  const signin = mode === "signin";
  const p = signin ? "signin" : "register";
  return (
    <section
      aria-labelledby={`${p}-heading`}
      data-account-form={mode}
      className="rounded-[22px] border border-brand-gold/35 bg-white/70 p-5 shadow-[0_18px_40px_-30px_rgba(60,45,20,0.45)] sm:p-7"
    >
      <h2 id={`${p}-heading`} className="font-serif text-[24px] leading-tight font-semibold text-brand-black sm:text-[26px]">
        {signin ? "Sign in" : "Create an account"}
      </h2>
      <p className="mt-1.5 text-[13.5px] text-brand-text/70">
        {signin ? "Access your profile and orders." : "Save your details and follow your orders."}
      </p>
      <form className="mt-5 space-y-4" aria-describedby="account-setup-notice" noValidate>
        <fieldset disabled={!enabled} className="space-y-4">
          <legend className="sr-only">{signin ? "Sign in details" : "Registration details"}</legend>
          {signin ? null : <Field id={`${p}-name`} label="Full name" autoComplete="name" />}
          <Field id={`${p}-email`} label="Email address" type="email" autoComplete="email" />
          {signin ? null : <Field id={`${p}-phone`} label="Mobile number" type="tel" autoComplete="tel" />}
          <Field id={`${p}-password`} label="Password" type="password" autoComplete={signin ? "current-password" : "new-password"} />
          <button
            type="submit"
            disabled={!enabled}
            className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-black text-[15px] font-semibold text-white transition-colors hover:bg-brand-text disabled:cursor-not-allowed disabled:bg-brand-black/35 ${FOCUS}`}
          >
            {enabled ? null : <LockKeyhole aria-hidden="true" className="size-4" strokeWidth={1.75} />}
            {signin ? "Sign in" : "Create account"}
          </button>
        </fieldset>
        {enabled ? null : <p className="text-center text-[12.5px] text-brand-text/60">Available once customer accounts open.</p>}
      </form>
    </section>
  );
}

/** Locked account section (profile / order history / order details). */
export function LockedPanel({
  Icon,
  title,
  description,
  action,
}: {
  Icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <section data-account-panel={title} className="flex flex-col rounded-[22px] border border-brand-gold/30 bg-brand-ivory p-5 sm:p-6">
      <span className="inline-flex size-11 items-center justify-center rounded-full border border-brand-gold/50 text-brand-black">
        <Icon aria-hidden="true" className="size-5" strokeWidth={1.5} />
      </span>
      <h2 className="mt-4 font-serif text-[22px] leading-tight font-semibold text-brand-black">{title}</h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-brand-text/75">{description}</p>
      <p className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium tracking-[0.06em] text-brand-text/55 uppercase">
        <LockKeyhole aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
        Available after you sign in
      </p>
      {action ? (
        <Link
          href={action.href}
          className={`mt-auto pt-4 text-[13px] font-semibold text-brand-black underline decoration-brand-gold/60 underline-offset-4 hover:decoration-brand-black ${FOCUS}`}
        >
          {action.label}
        </Link>
      ) : null}
    </section>
  );
}

export const ACCOUNT_SECTION_ICONS = { profile: UserRound, orders: Package, details: ReceiptText } as const;

/** "Sign in required" body used by the order pages. */
export function SignInRequired({ what }: { what: string }) {
  return (
    <div className="mx-auto max-w-2xl">
      <div data-sign-in-required className="rounded-[22px] border border-brand-gold/35 bg-white/70 p-6 text-center sm:p-9">
        <span className="mx-auto inline-flex size-12 items-center justify-center rounded-full border border-brand-gold/60 text-brand-black">
          <LockKeyhole aria-hidden="true" className="size-5" strokeWidth={1.6} />
        </span>
        <h2 className="mt-4 font-serif text-[26px] leading-tight font-semibold text-brand-black">Sign in to view {what}</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-brand-text/75">
          Your {what} will appear here once you are signed in to your Luftansa account.
        </p>
        <Link
          href="/account"
          className={`mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-brand-black px-6 text-[14px] font-semibold text-white transition-colors hover:bg-brand-text ${FOCUS}`}
        >
          Go to sign in
        </Link>
      </div>
      <div className="mt-6">
        <SetupNotice id="orders-setup-notice" />
      </div>
    </div>
  );
}
