import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail, MapPin, MessageCircle, Phone, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ContactComposer } from "@/components/contact/ContactComposer";
import { Breadcrumbs, PageFrame, PageHeader } from "@/components/layout/PageHeader";
import { CONTACT, mailHref, STORE_NAME, telHref, whatsappHref } from "@/data/store";

export const metadata: Metadata = {
  title: `Contact Us | ${STORE_NAME}`,
  description: `Contact ${STORE_NAME} on WhatsApp, by phone or by email, or visit us in Kadapa, Andhra Pradesh.`,
};

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold";

function Channel({ Icon, title, children, href, external, action }: { Icon: LucideIcon; title: string; children: ReactNode; href: string; external?: boolean; action: string }) {
  return (
    <li>
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className={`group flex h-full flex-col items-start gap-3 rounded-[20px] min-[400px]:flex-row min-[400px]:gap-4 border border-brand-gold/30 bg-white/80 p-5 transition-[border-color,box-shadow] hover:border-brand-gold hover:shadow-[0_14px_30px_-20px_rgba(60,45,20,0.45)] ${FOCUS}`}
      >
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-cream text-brand-black ring-1 ring-brand-gold/40">
          <Icon aria-hidden="true" className="size-5" strokeWidth={1.6} />
        </span>
        <span className="min-w-0">
          <span className="block font-serif text-[21px] leading-tight font-semibold text-brand-black">{title}</span>
          <span className="mt-1 block text-[14.5px] leading-relaxed break-words text-brand-text/80">{children}</span>
          <span className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold tracking-[0.08em] text-brand-black uppercase">
            {action}
            <ArrowRight aria-hidden="true" className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" strokeWidth={2} />
            {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
          </span>
        </span>
      </a>
    </li>
  );
}

/** Contact Us: confirmed contact channels, address and a message composer (WhatsApp / email). */
export default function ContactPage() {
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTACT.addressLines.join(" "))}`;
  return (
    <PageFrame width="max-w-6xl">
      <Breadcrumbs crumbs={[{ label: "Contact Us" }]} />
      <PageHeader eyebrow="We are here to help" title="Contact Us" intro="Questions about a fragrance, an order or a gift? Our team is happy to help on WhatsApp, by phone or by email." />

      <div className="mt-10 grid grid-cols-1 gap-8 sm:mt-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-10">
        <section aria-labelledby="contact-channels">
          <h2 id="contact-channels" className="sr-only">
            Ways to reach us
          </h2>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <Channel Icon={MessageCircle} title="WhatsApp" href={whatsappHref("Hello Luftansa, I have a question.")} external action="Chat with us">
              {CONTACT.phone}
            </Channel>
            <Channel Icon={Phone} title="Phone" href={telHref} action="Call us">
              {CONTACT.phone}
            </Channel>
            <Channel Icon={Mail} title="Email" href={mailHref} action="Write to us">
              {/* Long address: slightly smaller on phones so it stays on one line. */}
              <span className="text-[13px] min-[400px]:text-[14.5px] lg:text-[13.5px] xl:text-[14.5px]">{CONTACT.email}</span>
            </Channel>
            <Channel Icon={MapPin} title="Visit us" href={mapsHref} external action="Open in Google Maps">
              {CONTACT.addressLines.map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
            </Channel>
          </ul>
        </section>

        <section aria-labelledby="contact-message" className="rounded-[22px] border border-brand-gold/30 bg-brand-ivory p-5 shadow-[0_18px_40px_-30px_rgba(60,45,20,0.45)] sm:p-8">
          <h2 id="contact-message" className="font-serif text-[28px] leading-tight font-semibold text-brand-black sm:text-[32px]">
            Send us a message
          </h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-brand-text/75">Write your question below and send it to our team in one tap.</p>
          <div className="mt-6">
            <ContactComposer />
          </div>
        </section>
      </div>

      <p className="mt-12 text-center text-[14.5px] text-brand-text/75">
        Looking for a quick answer?{" "}
        <Link href="/faqs" className={`font-medium text-brand-black underline decoration-brand-gold/70 underline-offset-4 hover:decoration-brand-black ${FOCUS}`}>
          Read our FAQs
        </Link>
      </p>
    </PageFrame>
  );
}
