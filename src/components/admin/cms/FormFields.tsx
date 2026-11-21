"use client";

/**
 * Form building blocks shared by the CMS editors (Phase 3B): a titled card
 * and a text field with a character counter, help text and an inline error
 * wired to aria-describedby.
 */
import type { ReactNode } from "react";
import { INPUT } from "./ui";

export function Card({ icon, title, description, children, actions }: { icon: ReactNode; title: string; description?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#e3d6bd] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-brand-gold/30 bg-brand-cream text-brand-text/70">{icon}</span>
          <div className="min-w-0">
            <h2 className="font-serif text-[21px] leading-tight font-semibold text-brand-black">{title}</h2>
            {description ? <p className="mt-0.5 text-[13px] leading-snug text-brand-text/65">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="mt-5 space-y-6">{children}</div>
    </section>
  );
}

export function TextField({
  id,
  label,
  value,
  max,
  error,
  help,
  onChange,
  multiline,
  required,
  placeholder,
  rows = 2,
}: {
  id: string;
  label: string;
  value: string;
  max: number;
  error?: string;
  help?: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  required?: boolean;
  placeholder?: string;
  /** Visible lines for a multiline field (default 2). */
  rows?: number;
}) {
  const describedBy = [help ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    value,
    placeholder,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    "aria-required": required || undefined,
    className: `${INPUT} mt-1.5 ${error ? "border-[#c97f70]" : ""}`,
  };
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13.5px] font-semibold text-brand-black">
          {label} {required ? <span className="text-[#8a2f22]">*</span> : <span className="font-normal text-brand-text/50">(optional)</span>}
        </label>
        <span className={`text-[11.5px] tabular-nums ${value.length > max ? "text-[#8a2f22]" : "text-brand-text/45"}`}>
          {value.length}/{max}
        </span>
      </div>
      {multiline ? <textarea {...common} rows={rows} /> : <input type="text" {...common} />}
      {help ? (
        <p id={`${id}-help`} className="mt-1 text-[12px] leading-snug text-brand-text/55">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-[12.5px] text-[#8a2f22]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
