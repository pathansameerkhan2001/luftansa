"use client";

import { Flower2, Gem, Leaf, type LucideIcon } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { ProductDetailData } from "./types";

type TabKey = "notes" | "details" | "use";
const TABS: { key: TabKey; label: string }[] = [
  { key: "notes", label: "Fragrance Notes" },
  { key: "details", label: "Details" },
  { key: "use", label: "How to Use" },
];

const PENDING = <span className="text-brand-text/50 italic">To be confirmed</span>;

function NotesPanel({ notes }: { notes: ProductDetailData["notes"] }) {
  const tiers: { Icon: LucideIcon; label: string; value?: string }[] = [
    { Icon: Leaf, label: "Top Notes", value: notes.top },
    { Icon: Flower2, label: "Heart Notes", value: notes.heart },
    { Icon: Gem, label: "Base Notes", value: notes.base },
  ];
  return (
    <ul className="grid grid-cols-3 divide-x divide-brand-gold/25 rounded-2xl border border-brand-gold/25 bg-white/60 py-5">
      {tiers.map(({ Icon, label, value }) => (
        <li key={label} className="flex flex-col items-center px-2 text-center">
          <Icon aria-hidden="true" className="size-6 text-brand-black" strokeWidth={1.3} />
          <span className="mt-2 text-[13px] font-semibold text-brand-black">{label}</span>
          <span className="mt-0.5 text-[13px] text-brand-text/80">{value ?? PENDING}</span>
        </li>
      ))}
    </ul>
  );
}

function DetailsPanel({ product }: { product: ProductDetailData }) {
  const rows: [string, ReactNode][] = [
    ["Fragrance", product.name],
    ["Type", product.category],
    ["Available sizes", product.options.map((o) => o.label).join(" · ") || PENDING],
    ["Perfect for", product.perfectFor ?? PENDING],
    ["Oil concentration", product.concentration ?? PENDING],
    ["Gender", product.gender ?? PENDING],
  ];
  return (
    <dl className="divide-y divide-brand-gold/20 rounded-2xl border border-brand-gold/25 bg-white/60 px-4 sm:px-5">
      {rows.map(([term, value]) => (
        <div key={term} className="flex justify-between gap-4 py-3 text-[13.5px]">
          <dt className="text-brand-text/65">{term}</dt>
          <dd className="text-right font-medium text-brand-black">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function HowToUsePanel() {
  // General fragrance-application guidance; no product-specific performance claims.
  const steps = [
    "Apply to clean, moisturised skin; fragrance tends to sit better on hydrated skin.",
    "Hold the bottle a short distance away and spray lightly on pulse points such as the wrists, neck and behind the ears.",
    "Let it dry naturally rather than rubbing your wrists together.",
    "Store the bottle closed, away from direct sunlight and heat.",
  ];
  return (
    <ol className="space-y-2.5 rounded-2xl border border-brand-gold/25 bg-white/60 p-4 text-[13.5px] leading-relaxed text-brand-text/85 sm:p-5">
      {steps.map((step, i) => (
        <li key={step} className="flex gap-3">
          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-brand-gold/60 text-[11.5px] font-semibold text-brand-black">
            {i + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
  );
}

/** Fragrance Notes / Details / How to Use tabs (WAI-ARIA tabs pattern). */
export function ProductTabs({ product }: { product: ProductDetailData }) {
  const [tab, setTab] = useState<TabKey>("notes");
  const baseId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.key === tab);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const j = (next + TABS.length) % TABS.length;
    setTab(TABS[j].key);
    refs.current[j]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label="Product information" onKeyDown={onKeys} className="flex gap-1 overflow-x-auto border-b border-brand-gold/30 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t, i) => {
          const selected = t.key === tab;
          return (
            <button
              key={t.key}
              ref={(el) => {
                refs.current[i] = el;
              }}
              id={`${baseId}-tab-${t.key}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${t.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.key)}
              className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-[13.5px] whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-gold sm:px-4 ${
                selected ? "border-brand-gold font-semibold text-brand-black" : "border-transparent text-brand-text/70 hover:text-brand-black"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {TABS.map((t) => (
        <div
          key={t.key}
          id={`${baseId}-panel-${t.key}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${t.key}`}
          hidden={t.key !== tab}
          tabIndex={0}
          className="pt-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
        >
          {t.key === "notes" ? <NotesPanel notes={product.notes} /> : t.key === "details" ? <DetailsPanel product={product} /> : <HowToUsePanel />}
        </div>
      ))}
    </div>
  );
}
