import Link from "next/link";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { CONTACT, mailHref, telHref, whatsappHref } from "@/data/store";
import { POLICY_LABEL, POLICY_ROUTE, type PolicyKey, type PolicyView } from "@/lib/cms/modules/policy-pages";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold";
const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export const sectionAnchor = (i: number) => `section-${i + 1}`;

/** "Need help?" card with the confirmed contact channels (used on policy, FAQ and collection pages). */
export function HelpCard({ title = "Need help?", text = "Our team is happy to help with orders and any questions." }: { title?: string; text?: string }) {
  const link = `inline-flex min-h-11 items-center gap-2.5 rounded-full border border-brand-gold/50 bg-white/80 px-4 text-[13.5px] font-medium text-brand-black transition-colors hover:border-brand-gold hover:bg-brand-ivory ${FOCUS}`;
  return (
    <aside aria-label={title} className="rounded-[22px] border border-brand-gold/35 bg-brand-ivory px-5 py-6 text-center sm:px-8 sm:py-8">
      <h2 className="font-serif text-[24px] leading-tight font-semibold text-brand-black sm:text-[28px]">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-[14.5px] leading-relaxed text-brand-text/75">{text}</p>
      <ul className="mt-5 flex flex-wrap justify-center gap-2.5">
        <li>
          <a href={whatsappHref("Hello Luftansa, I have a question.")} target="_blank" rel="noopener noreferrer" className={link}>
            <MessageCircle aria-hidden="true" className="size-4 text-brand-gold" strokeWidth={1.75} />
            WhatsApp<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </li>
        <li>
          <a href={telHref} className={link}>
            <Phone aria-hidden="true" className="size-4 text-brand-gold" strokeWidth={1.75} />
            {CONTACT.phone}
          </a>
        </li>
        <li>
          <a href={mailHref} className={`${link} max-w-full`}>
            <Mail aria-hidden="true" className="size-4 shrink-0 text-brand-gold" strokeWidth={1.75} />
            <span className="sr-only">Email </span>
            <span className="truncate">{CONTACT.email}</span>
          </a>
        </li>
      </ul>
    </aside>
  );
}

/** Body of a policy page: sections (plain text → paragraphs and lists), on-page contents, other policies. */
export function PolicyArticle({ view, otherPolicies }: { view: PolicyView; otherPolicies: readonly PolicyKey[] }) {
  return (
    <div className="mt-10 grid grid-cols-1 gap-10 sm:mt-12 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14" data-policy={view.key}>
      {view.sections.length > 1 ? (
        <nav aria-label="On this page" className="hidden lg:block">
          <div className="sticky top-8">
            <p className="text-[11px] font-semibold tracking-[0.24em] text-brand-text/60 uppercase">On this page</p>
            <ol className="mt-3 space-y-1 border-l border-brand-gold/35">
              {view.sections.map((s, i) => (
                <li key={i}>
                  <a href={`#${sectionAnchor(i)}`} className={`-ml-px block border-l border-transparent py-1.5 pl-4 text-[13.5px] leading-snug text-brand-text/75 hover:border-brand-gold hover:text-brand-black ${FOCUS}`}>
                    {s.heading}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>
      ) : (
        <div className="hidden lg:block" />
      )}

      <div className="min-w-0">
        <article className="rounded-[22px] border border-brand-gold/25 bg-white/80 px-5 py-7 shadow-[0_14px_30px_-22px_rgba(60,45,20,0.35)] sm:px-10 sm:py-10">
          {view.lastUpdated ? (
            <p className="mb-6 text-[12.5px] tracking-[0.06em] text-brand-text/60 uppercase">Last updated {dateFmt.format(new Date(view.lastUpdated))}</p>
          ) : null}
          <div className="space-y-9">
            {view.sections.map((s, i) => (
              <section key={i} id={sectionAnchor(i)} aria-labelledby={`${sectionAnchor(i)}-h`} className="scroll-mt-8">
                <h2 id={`${sectionAnchor(i)}-h`} className="font-serif text-[24px] leading-tight font-semibold text-brand-black sm:text-[27px]">
                  {s.heading}
                </h2>
                <span aria-hidden="true" className="mt-2.5 block h-px w-10 bg-brand-gold" />
                <div className="mt-4 space-y-3.5 text-[15px] leading-[1.75] text-pretty text-brand-text/85 sm:text-[15.5px]">
                  {s.blocks.map((b, j) =>
                    b.kind === "p" ? (
                      <p key={j}>{b.text}</p>
                    ) : (
                      <ul key={j} className="space-y-1.5 pl-1">
                        {b.items.map((item, k) => (
                          <li key={k} className="flex gap-3">
                            <span aria-hidden="true" className="mt-[0.7em] size-1.5 shrink-0 rotate-45 bg-brand-gold" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ),
                  )}
                </div>
              </section>
            ))}
          </div>
        </article>

        <div className="mt-8">
          <HelpCard title="Questions about this policy?" />
        </div>

        {otherPolicies.length ? (
          <nav aria-label="Other policies" className="mt-8 text-center">
            <p className="text-[11px] font-semibold tracking-[0.24em] text-brand-text/60 uppercase">Other policies</p>
            <ul className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-2">
              {otherPolicies.map((k) => (
                <li key={k}>
                  <Link href={POLICY_ROUTE[k]} className={`inline-flex min-h-10 items-center text-[14px] text-brand-black underline decoration-brand-gold/60 underline-offset-4 hover:decoration-brand-black ${FOCUS}`}>
                    {POLICY_LABEL[k]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
