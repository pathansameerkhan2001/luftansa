import { Construction } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Honest placeholder for an admin section that is not built yet. It never
 * shows sample or fake data, only what the section will provide and when.
 */
export function AdminPlaceholder({
  title,
  description,
  phase,
  capabilities,
  children,
}: {
  title: string;
  description: string;
  phase: number;
  capabilities: readonly string[];
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-[30px] leading-tight font-semibold sm:text-[34px]">{title}</h1>
          <p className="mt-1 text-[14px] text-brand-text/70">{description}</p>
        </div>
        <span data-admin-phase={phase} className="inline-flex items-center rounded-full border border-brand-gold/60 bg-white px-3 py-1 text-[11.5px] font-semibold tracking-[0.08em] text-[#7a5a2b] uppercase">
          Planned · Phase {phase}
        </span>
      </div>

      <section data-admin-placeholder className="mt-6 rounded-2xl border border-[#e3d6bd] bg-[#fffdf8] p-6 shadow-[0_1px_2px_rgba(23,23,23,0.04)] sm:p-8">
        <div className="flex items-start gap-4">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#161513] text-[#c6a76a]">
            <Construction aria-hidden="true" className="size-5" strokeWidth={1.6} />
          </span>
          <div>
            <h2 className="text-[16px] font-semibold">Not available yet</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-brand-text/75">
              This section is part of a later phase. No data is shown here until it is connected to the store database.
            </p>
          </div>
        </div>
        <h3 className="mt-6 text-[12px] font-semibold tracking-[0.12em] text-brand-text/60 uppercase">What this section will include</h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {capabilities.map((c) => (
            <li key={c} className="flex items-start gap-2 text-[14px] text-brand-text/85">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-gold" />
              {c}
            </li>
          ))}
        </ul>
        {children}
      </section>
    </div>
  );
}
