import Link from "next/link";
import type { ReactNode } from "react";
import { FlourishIcon } from "@/components/collection/icons";

export interface Crumb {
  label: string;
  href?: string;
}

/** Breadcrumb trail: Home / … / current page. */
export function Breadcrumbs({ crumbs }: { crumbs: readonly Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[12.5px] text-brand-text/65">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href="/" className="hover:text-brand-black hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold">
            Home
          </Link>
        </li>
        {crumbs.map((c) => (
          <li key={c.label} className="flex items-center gap-1.5">
            <span aria-hidden="true">/</span>
            {c.href ? (
              <Link href={c.href} className="hover:text-brand-black hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold">
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
  );
}

/**
 * Storefront page header (same look as the Perfumes and Roll-On listings):
 * gold flourish, eyebrow between hairlines, italic serif title, introduction.
 */
export function PageHeader({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mx-auto mt-8 max-w-2xl text-center sm:mt-10">
      <span aria-hidden="true" className="inline-flex text-brand-gold">
        <FlourishIcon className="size-9 sm:size-10" />
      </span>
      <p className="mt-3 flex items-center justify-center gap-3 text-[11px] font-medium tracking-[0.24em] text-brand-black uppercase min-[400px]:gap-4 min-[400px]:tracking-[0.32em] sm:gap-6 sm:text-[12px]">
        <span aria-hidden="true" className="h-px w-6 shrink-0 bg-brand-gold/70 min-[400px]:w-10 sm:w-20" />
        <span className="min-w-0 text-balance">{eyebrow}</span>
        <span aria-hidden="true" className="h-px w-6 shrink-0 bg-brand-gold/70 min-[400px]:w-10 sm:w-20" />
      </p>
      <h1 className="mt-3 font-serif text-[36px] leading-[1.08] font-semibold tracking-[-0.01em] text-balance text-brand-black italic min-[400px]:text-[42px] sm:text-[54px]">{title}</h1>
      {intro ? <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-pretty text-brand-text/80 sm:text-[17px]">{intro}</p> : null}
      {children}
    </header>
  );
}

/** Standard storefront page frame (cream background, consistent widths and spacing). */
export function PageFrame({ children, className = "", width = "max-w-7xl" }: { children: ReactNode; className?: string; width?: string }) {
  return (
    <main className={`bg-brand-cream ${className}`}>
      <div className={`mx-auto ${width} px-4 pt-6 pb-16 sm:px-8 sm:pt-8 sm:pb-24`}>{children}</div>
    </main>
  );
}
