import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { InstagramGlyph } from "@/components/reels/InstagramGlyph";
import { CONTACT, mailHref, SOCIAL_LINKS, STORE_NAME, telHref, whatsappHref } from "@/data/store";
import { BRAND_ASSETS, getAssetUrl } from "@/lib/assets";
import { ABOUT_ROUTE } from "@/lib/routes";

/* ------------------------------------------------------------------ logo --- */

// Same non-destructive window onto the original logo as the header (artwork +
// wordmark, tagline excluded). The image file itself is never altered.
const LOGO = BRAND_ASSETS.logo;
const WINDOW = { x: 175, y: 212, width: 903, height: 1074 } as const;
const pct = (n: number) => `${(n * 100).toFixed(4)}%`;

function FooterLogo() {
  return (
    <Link
      href="/"
      aria-label="Luftansa — home"
      className="inline-block rounded-2xl bg-brand-ivory p-3 ring-1 ring-brand-gold/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold"
    >
      <span className="relative block h-[84px] overflow-hidden" style={{ aspectRatio: `${WINDOW.width} / ${WINDOW.height}` }}>
        <Image
          src={getAssetUrl(LOGO.key)}
          alt="Luftansa"
          width={LOGO.width}
          height={LOGO.height}
          sizes="90px"
          className="absolute mix-blend-multiply"
          style={{
            width: pct(LOGO.width / WINDOW.width),
            height: pct(LOGO.height / WINDOW.height),
            left: pct(-WINDOW.x / WINDOW.width),
            top: pct(-WINDOW.y / WINDOW.height),
            maxWidth: "none",
          }}
        />
      </span>
    </Link>
  );
}

/* ----------------------------------------------------------------- links --- */

interface FooterLink {
  label: string;
  /** Unset = the destination does not exist yet (rendered as "coming soon", never a dead link). */
  href?: string;
}

const EXPLORE: FooterLink[] = [
  { label: "Perfumes", href: "/#personality-collection-heading" },
  { label: "Attar" },
  { label: "Roll On", href: "/#roll-on-collection-heading" },
  { label: "Personality Collection", href: "/#personality-collection-heading" },
  { label: "Explore by Notes", href: "/#explore-notes-heading" },
  { label: "Best Sellers", href: "/#best-sellers-heading" },
];

const SERVICE: FooterLink[] = [
  { label: "Contact Us", href: "#footer-contact" },
  { label: "About Us", href: ABOUT_ROUTE ?? "/#brand-story-heading" },
  { label: "FAQs", href: "/#faqs" },
  { label: "Shipping Policy" },
  { label: "Return Policy" },
  { label: "Privacy Policy" },
  { label: "Terms and Conditions" },
];

const LINK = "text-[14px] text-white/60 transition-colors hover:text-brand-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold";

function LinkColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <nav aria-label={title}>
      <FooterHeading>{title}</FooterHeading>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            {l.href ? (
              <Link href={l.href} className={LINK}>
                {l.label}
              </Link>
            ) : (
              <span className="text-[14px] text-white/35" data-pending-link>
                {l.label}
                <span className="ml-2 rounded-full border border-white/15 px-1.5 py-px text-[9.5px] tracking-[0.1em] text-white/40 uppercase">
                  Coming soon
                </span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

function FooterHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[15px] font-semibold tracking-[0.02em] text-white">
      {children}
      <span aria-hidden="true" className="mt-2 block h-px w-8 bg-brand-gold/70" />
    </h2>
  );
}

/* ---------------------------------------------------------------- social --- */

function FacebookGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3Z" />
    </svg>
  );
}

function YoutubeGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z" />
    </svg>
  );
}

function SocialLinks() {
  // Only confirmed profiles are linked; WhatsApp uses the confirmed store number.
  const candidates: { label: string; href?: string; icon: ReactNode }[] = [
    { label: "Instagram", href: SOCIAL_LINKS.instagram, icon: <InstagramGlyph mono className="size-[18px]" /> },
    { label: "Facebook", href: SOCIAL_LINKS.facebook, icon: <FacebookGlyph className="size-[18px]" /> },
    { label: "YouTube", href: SOCIAL_LINKS.youtube, icon: <YoutubeGlyph className="size-[18px]" /> },
    { label: "WhatsApp", href: whatsappHref(), icon: <MessageCircle className="size-[18px]" strokeWidth={1.75} /> },
  ];
  const items = candidates.filter((i): i is { label: string; href: string; icon: ReactNode } => Boolean(i.href));

  return (
    <ul className="mt-4 flex flex-wrap gap-2.5">
      {items.map((i) => (
        <li key={i.label}>
          <a
            href={i.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${i.label} (opens in a new tab)`}
            className="inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/10 transition-colors hover:bg-brand-gold hover:text-brand-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
          >
            {i.icon}
          </a>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------------- footer --- */

export function SiteFooter() {
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTACT.addressLines.join(" "))}`;

  return (
    <footer className="bg-[#1c1b19] text-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 pt-14 pb-10 sm:grid-cols-2 sm:px-8 sm:pt-16 lg:grid-cols-[1.5fr_1fr_1fr_0.9fr] lg:gap-12">
        <div id="footer-contact" className="scroll-mt-6 sm:col-span-2 lg:col-span-1">
          <FooterLogo />
          <p className="mt-5 max-w-sm text-[14px] leading-relaxed text-white/60">
            Luftansa Fragrance Craft Hub brings together distinctive scents and thoughtful craftsmanship, created for every
            mood, moment and personality.
          </p>
          <address className="mt-5 space-y-3 text-[14px] not-italic text-white/70">
            <a href={mailHref} className={`flex items-start gap-3 break-all ${LINK}`}>
              <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-gold" strokeWidth={1.75} />
              <span>
                <span className="sr-only">Email: </span>
                {CONTACT.email}
              </span>
            </a>
            <a href={telHref} className={`flex items-start gap-3 ${LINK}`}>
              <Phone aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-gold" strokeWidth={1.75} />
              <span>
                <span className="sr-only">Phone and WhatsApp: </span>
                {CONTACT.phone} <span className="text-white/40">(Phone / WhatsApp)</span>
              </span>
            </a>
            <a href={mapsHref} target="_blank" rel="noopener noreferrer" className={`flex items-start gap-3 ${LINK}`}>
              <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-gold" strokeWidth={1.75} />
              <span>
                <span className="sr-only">Address (opens Google Maps in a new tab): </span>
                {CONTACT.addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </span>
            </a>
          </address>
        </div>

        <LinkColumn title="Explore" links={EXPLORE} />
        <LinkColumn title="Customer Service" links={SERVICE} />

        <div>
          <FooterHeading>Follow Us</FooterHeading>
          <SocialLinks />
          <a href={whatsappHref()} target="_blank" rel="noopener noreferrer" className={`mt-4 inline-block ${LINK}`}>
            Chat with us on WhatsApp
          </a>
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-5 text-center text-[12.5px] text-white/50 sm:px-8">
          © {STORE_NAME}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
