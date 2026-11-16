import Image from "next/image";
import { Flower2, Gem, Leaf, type LucideIcon } from "lucide-react";
import type { NoteDetail, ProductDetailData } from "./types";

const TIERS: { key: "top" | "heart" | "base"; label: string; hint: string; Icon: LucideIcon }[] = [
  { key: "top", label: "Top Notes", hint: "The first impression", Icon: Leaf },
  { key: "heart", label: "Heart Notes", hint: "The character", Icon: Flower2 },
  { key: "base", label: "Base Notes", hint: "The lasting depth", Icon: Gem },
];

function NoteCard({ note, tier, Icon }: { note: NoteDetail; tier: string; Icon: LucideIcon }) {
  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-[20px] bg-white/85 ring-1 ring-brand-gold/25 shadow-[0_14px_30px_-22px_rgba(60,45,20,0.45)]">
      <div className="relative aspect-[4/3] bg-[radial-gradient(110%_80%_at_50%_40%,#ffffff_0%,var(--brand-cream)_100%)]">
        {note.image ? (
          <Image
            src={note.image.src}
            alt={note.image.alt || note.name}
            fill
            loading="lazy"
            sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 80vw"
            className="object-cover"
          />
        ) : (
          <Icon aria-hidden="true" className="absolute top-1/2 left-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-brand-gold/60" strokeWidth={1} />
        )}
      </div>
      <div className="px-4 pt-3.5 pb-4">
        <p className="text-[10.5px] font-semibold tracking-[0.2em] text-brand-gold uppercase">{tier}</p>
        <h4 className="mt-1 font-serif text-[21px] leading-tight font-semibold text-brand-black">{note.name}</h4>
        {note.description ? <p className="mt-1.5 text-[13.5px] leading-relaxed text-brand-text/75">{note.description}</p> : null}
      </div>
    </li>
  );
}

/**
 * Visual fragrance notes (Top / Heart / Base) with the note photography stored
 * for each note. Renders nothing when the product has no confirmed notes;
 * empty tiers are skipped. Never shows placeholder ingredients.
 */
export function FragranceNotesShowcase({ product }: { product: ProductDetailData }) {
  const notes = product.fragranceNotes;
  if (product.hasNotes === false || !notes) return null;
  const tiers = TIERS.map((t) => ({ ...t, items: notes[t.key] })).filter((t) => t.items.length > 0);
  if (tiers.length === 0) return null;

  return (
    <section id="fragrance-notes" aria-labelledby="fragrance-notes-heading" className="scroll-mt-6 bg-brand-cream">
      <div className="mx-auto max-w-[1320px] px-4 py-14 sm:px-8 sm:py-20">
        <header className="mx-auto max-w-2xl text-center">
          <p className="flex items-center justify-center gap-4 text-[11px] font-medium tracking-[0.32em] text-brand-black uppercase sm:text-[12px]">
            <span aria-hidden="true" className="h-px w-10 bg-brand-gold/70 sm:w-16" />
            The Composition
            <span aria-hidden="true" className="h-px w-10 bg-brand-gold/70 sm:w-16" />
          </p>
          <h2 id="fragrance-notes-heading" className="mt-3 font-serif text-[34px] leading-[1.08] font-semibold italic text-brand-black sm:text-[46px]">
            Fragrance Notes
          </h2>
        </header>

        <div className={`mt-10 grid gap-8 sm:mt-12 ${tiers.length >= 3 ? "lg:grid-cols-3" : tiers.length === 2 ? "md:grid-cols-2" : ""} lg:gap-7`}>
          {tiers.map(({ key, label, hint, Icon, items }) => (
            <div key={key} className="min-w-0">
              <div className="flex items-center gap-3 border-b border-brand-gold/35 pb-3">
                <span className="inline-flex size-9 items-center justify-center rounded-full border border-brand-gold/50 bg-white text-brand-gold">
                  <Icon aria-hidden="true" className="size-[18px]" strokeWidth={1.4} />
                </span>
                <div>
                  <h3 className="text-[13px] font-semibold tracking-[0.18em] text-brand-black uppercase">{label}</h3>
                  <p className="text-[12.5px] text-brand-text/60">{hint}</p>
                </div>
              </div>
              <ul className={`mt-5 grid gap-4 ${tiers.length === 1 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-1"}`}>
                {items.map((note) => (
                  <NoteCard key={note.name} note={note} tier={label.replace(" Notes", "")} Icon={Icon} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
